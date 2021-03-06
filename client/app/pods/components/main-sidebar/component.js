//
//   Copyright 2009-2015 Ilkka Oksanen <iao@iki.fi>
//
//   Licensed under the Apache License, Version 2.0 (the "License");
//   you may not use this file except in compliance with the License.
//   You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
//   Unless required by applicable law or agreed to in writing,
//   software distributed under the License is distributed on an "AS
//   IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
//   express or implied.  See the License for the specific language
//   governing permissions and limitations under the License.
//

import { autorun } from 'mobx';
import { computed } from '@ember/object';
import Component from '@ember/component';
import settingStore from '../../../stores/SettingStore';
import friendStore from '../../../stores/FriendStore';
import { dispatch } from '../../../utils/dispatcher';

export default Component.extend({
  init(...args) {
    this._super(...args);

    this.disposers = [
      autorun(() => this.set('canUseIRC', settingStore.settings.canUseIRC)),
      autorun(() => this.set('darkTheme', settingStore.settings.theme === 'dark')),
      autorun(() => this.set('friends', Array.from(friendStore.friends.values())))
    ];
  },

  didDestroyElement() {
    this.disposers.forEach(element => element());
  },

  classNames: ['sidebar', 'flex-grow-column'],

  draggedWindow: false,

  actions: {
    openModal(modal) {
      dispatch('OPEN_MODAL', { name: modal });
    },

    logout() {
      dispatch('LOGOUT');
    },

    logoutAll() {
      dispatch('LOGOUT', { allSessions: true });
    },

    toggleDarkTheme() {
      dispatch('TOGGLE_THEME');
    },

    switchClient() {
      dispatch('SWITCH_CLIENT');
    }
  },

  friendsOnline: computed('friends.@each.online', function () {
    return this.friends.filterBy('online', true).length;
  })
});
