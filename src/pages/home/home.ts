import { Component } from '@angular/core';
import { NavController } from 'ionic-angular';
import { AlertController } from 'ionic-angular';

import { FirebaseStoreProvider } from '../../providers/firebase-store/firebase-store';
import { ChannelPage } from '../channel/channel';


@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  userName: string;
  newUserName: string;
  channelCode: string;
  fetching: false;
  registering: false;
  joining: false;

  constructor(public navCtrl: NavController, private firebaseStore: FirebaseStoreProvider, public alertCtrl: AlertController) {
    // console.log('channels', firebase.database().ref('channels/'));
    this.connect();
  }

  connect() {
    const self = this;
    this.fetching = true;
    this.firebaseStore.getDeviceId()
      .then(uuid => {

        self.firebaseStore.getUserProfile(uuid)
          .then(userProfile => {
            self.fetching = false;

            // if new user.
            if (userProfile === null) {
              console.log('new user');
              // if device has been registered previously
            } else {
              self.userName = userProfile.name;
              console.log('existing user', self.userName);
            }
          })
          .catch(error => {
            this.alertCtrl.create({
              title: 'Error',
              subTitle: 'Could not connect. - Please connect to Internet and restart App.',
              buttons: ['ok']
            }).present();
            connect();
          });
      });
  }

  // registers the new user
  registerUser() {
    const self = this;

    self.registering = true;
    this.firebaseStore.registerUser(this.newUserName)
      .then(() => {
        self.registering = false;
        self.userName = this.newUserName;

        this.alertCtrl.create({
          title: 'Successful !',
          subTitle: 'You have been registered successfully.',
          buttons: ['Join Channel']
        }).present();
      })
      .catch(error => {
        self.registering = false;

        this.alertCtrl.create({
          title: 'Error',
          subTitle: error,
          buttons: ['Try Again']
        }).present();
      });
  }

  // attempts to join the channel
  joinChannel() {
    const self = this;

    self.joining = true;
    this.firebaseStore.getChannelCode(this.channelCode)
      .then((channelId) => {
        self.joining = false;
        console.log('verifyChannelCode success');

        // navigate to channel page
        this.navCtrl.setRoot(ChannelPage, {
          channelId: channelId
        });
      })
      .catch(error => {
        self.joining = false;

        this.alertCtrl.create({
          title: 'Error',
          subTitle: error,
          buttons: ['Try Again']
        }).present();
      });
  }
}
