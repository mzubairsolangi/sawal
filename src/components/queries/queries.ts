import { Component, OnDestroy } from '@angular/core';
import { AlertController, LoadingController } from 'ionic-angular';

import * as moment from 'moment';

import { FirebaseStoreProvider } from '../../providers/firebase-store/firebase-store';
import { UtilProvider } from '../../providers/util/util';

@Component({
  selector: 'queries',
  templateUrl: 'queries.html'
})
export class QueriesComponent implements OnDestroy {
  expandedComments: any = {};
  fetching: boolean = false;
  fetchingError: string;
  waitState: any;
  questions = [];
  unSubscribeQuestionsList: Function;
  dispatchers: any = {};
  isAdmin: boolean = false;

  constructor( private firebaseStore: FirebaseStoreProvider,
               private utilService: UtilProvider,
               public alertCtrl: AlertController,
               public loadingCtrl: LoadingController
  ) {
    this.checkApprovedQuestionsList();
    this.fetchApprovedQuestions();

    // for now making all users an admin
    this.isAdmin = true;
  }

  // retrieves the count / length of the object
  getCount = (list) => {
    return Object.keys(list || {}).length;
  };

  formatDate = (timestamp) => {
    return moment(timestamp).fromNow();
  };

  // filter questions with respect to active filter
  matchFilter = (question) => {
    return question && question.approvedBy;
  };

  // hides the loading popup, if not hided before.
  hideWaitScreen() {
    if (this.waitState) {
      this.fetching = false;
      this.waitState.dismiss();
      this.waitState = null;
    }
  }

  // checks if there is any approved question or empty list.
  checkApprovedQuestionsList() {
    this.fetching = true;
    this.waitState = this.loadingCtrl.create({
      content: 'Loading list...'
    });

    this.waitState.present();
    this.firebaseStore.hasQuestions(this.matchFilter, null)
      .then(hasApprovedQuestion => {

        // if no pending questions, then show inform user.
        if (!hasApprovedQuestion) {
          this.hideWaitScreen();
          //return;
        }

        // otherwise - wait for the fetchApprovedQuestions() to hide the fetching.
      })
      .catch(error => {
        this.fetching = false;
        this.fetchingError = error;
      });
  }

  // subscription - to be invoked on new comment is added
  commentsListOnAdd(comment, questionId) {

    // find the index of target question
    const questionIndex = this.utilService.getIndexOf(this.questions, 'questionId', questionId);

    if (questionIndex === undefined) {
      console.warn('commentsListOnAdd: could not find question. already removed ?', questionId);
      return;
    }

    const question = this.questions[questionIndex];

    // add new comments into the question comments list.
    question.comments.push(comment);
  }

  // subscription - to be invoked on existing comment is removed
  commentsListOnRemove(commentId, questionId) {

    // find the index of target question
    const questionIndex = this.utilService.getIndexOf(this.questions, 'questionId', questionId);

    if (questionIndex === undefined) {
      console.warn('commentsListOnAdd: could not find question. already removed ?', questionId);
      return;
    }

    const question = this.questions[questionIndex];

    // find the index of target comment
    const commentIndex = this.utilService.getIndexOf(question.comments, 'commentId', commentId);

    if (commentIndex === undefined) {
      console.warn('commentsListOnAdd: could not find comment. already removed ?', commentId);
      return;
    }

    // remove the target comment form the question comment list.
    question.comments.splice(questionIndex, 1);
  }

  // subscription - to be invoked on new question added
  questionsListOnAdd(question) {

    // if not approved yet, monitor the approval.
    if (!this.matchFilter(question)) {

      const subscriber = this.firebaseStore.channelQuestionOnApprove(question.questionId);

      // add dispatcher for onDestroy removal
      this.dispatchers[question.questionId] = subscriber.dispatcher;

      subscriber.promise
        .then((approvedQuestion) => {

          // question has been approved now - add it into the list
          this.questionsListOnAdd(approvedQuestion);

          // call dispatcher
          subscriber.dispatcher();

          // remove dispatcher from dispatchers list to avoid duplicate calls
          delete this.dispatchers[question.questionId];
        })
        .catch((error) => {
          console.log('questionsListOnAdd: monitor approval failed', error);
        });

      return;
    }

    // hide the wait screen (if any)
    this.hideWaitScreen();

    // add new question into the questions list.
    this.questions.push(question);

    const actions = {
      onAdd: (comment, questionId) => this.commentsListOnAdd(comment, questionId),
      onRemove: (commentId, questionId) => this.commentsListOnRemove(commentId, questionId)
    };

    // subscribe to question comments.
    question.unSubscribeCommentsList = this.firebaseStore.subscribeQuestionComments(question.questionId, actions);
  }

  // subscription - to be invoked on existing question removed
  questionsListOnRemove(questionId) {

    // find the index of target question to be removed.
    const questionIndex = this.utilService.getIndexOf(this.questions, 'questionId', questionId);

    if (questionIndex !== undefined) {
      const question = this.questions[questionIndex];

      // dispatch the comments listeners
      question.unSubscribeCommentsList();

      this.questions.splice(questionIndex, 1);
    }
  }

  // sync with the pending questions all the time.
  fetchApprovedQuestions() {
    const actions = {
      onAdd: (question) => this.questionsListOnAdd(question),
      onRemove: (questionId) => this.questionsListOnRemove(questionId)
    };

    // subscribe and keep the dispatcher
    this.unSubscribeQuestionsList = this.firebaseStore.subscribeChannelQuestions(null, actions);
  }

  // removes the selected question from the channels list and questions list as well.
  removeQuestion(questionId) {

    // ask for confirmation first.
    this.utilService.confirmRemove()
      .then(() => {

        const wait = this.loadingCtrl.create({
          content: 'Please give us a moment...'
        });

        wait.present();
        this.firebaseStore.removeQuestion(questionId)
          .then(() => {
            // question removal from local array list is done via fetchApprovedQuestions()
            wait.dismiss();
          })
          .catch(error => {
            wait.dismiss();

            this.alertCtrl.create({
              title: 'Error',
              subTitle: error,
              buttons: ['OK']
            }).present();
          });
      })
      .catch((error) => {
        // handle error here.
      });
  }

  // removes the selected question from the channels list and questions list as well.
  removeAnswer(questionId, commentId) {

    // ask for confirmation first.
    this.utilService.confirmRemove()
      .then(() => {

        const wait = this.loadingCtrl.create({
          content: 'Please give us a moment...'
        });

        wait.present();
        this.firebaseStore.removeAnswer(questionId, commentId)
          .then(() => {
            // comment removal from local array list is done via fetchApprovedQuestions()
            wait.dismiss();
          })
          .catch(error => {

            this.alertCtrl.create({
              title: 'Error',
              subTitle: error,
              buttons: ['OK']
            }).present();
          });
      });
  }

  submitComment(question) {

    // payload validation
    if (!question.newCommentText || question.newCommentText.length < 10) {

      this.alertCtrl.create({
        title: 'Error',
        subTitle: 'Answer text can be minimum 10 characters and maximum 5000 characters.',
        buttons: ['Try Again']
      }).present();

      return;
    }

    question.commenting = true;
    this.firebaseStore.submitComment(question.newCommentText, question.questionId)
      .then(() => {
        question.commenting = false;
        question.showCommentBox = false;
        question.newCommentText = '';

        this.alertCtrl.create({
          title: 'Successful !',
          subTitle: 'Your answer has been submitted successfully.',
          buttons: ['OK']
        }).present();

      })
      .catch(error => {
        question.commenting = false;

        this.alertCtrl.create({
          title: 'Error',
          subTitle: error,
          buttons: ['OK']
        }).present();
      });
  }

  // to be invoked when view is about to be destroyed.
  ngOnDestroy() {
    this.unSubscribeQuestionsList();

    // clear listeners for questions pending approval state
    for (let questionId in this.dispatchers) {
      this.dispatchers[questionId]();
    }

    // clear listeners for questions comments list
    for (let i = 0; i < this.questions.length; i++) {
      this.questions[i].unSubscribeCommentsList();
    }
  }

}
