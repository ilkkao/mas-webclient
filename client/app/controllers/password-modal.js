//
//   Copyright 2009-2014 Ilkka Oksanen <iao@iki.fi>
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

'use strict';

import Ember from 'ember';

export default Ember.Controller.extend({
    modalPassword: null,
    modalPasswordStatus: null,
    errorMsg: '',

    actions: {
        changePassword: function() {
            // User has clicked 'OK', send the new password to server
            let newPassword = null;

            if (this.get('modalPasswordStatus') === 'enabled') {
                newPassword = this.get('modalPassword');
            }

            this.remote.send({
                id: 'UPDATE_PASSWORD',
                windowId: this.get('model.windowId'),
                password: newPassword === null ? '' : newPassword
            }, function(resp) {
                if (resp.status === 'OK') {
                    this.send('closeModal');
                } else {
                    this.set('errorMsg', resp.errorMsg);
                }
            }.bind(this));
        },

        cancel: function() {
            this._updateModalPassword();
            this.send('closeModal');
        }
    },

    passwordDidChange: function() {
        this._updateModalPassword();
    }.observes('model.password').on('init'),

    modalPasswordDisabled: function() {
        return this.get('modalPasswordStatus') !== 'enabled';
    }.property('modalPasswordStatus'),

    passwordTitle: function() {
        return 'Change Password for \'' + this.get('model.name') + '\'';
    }.property('model.name'),

    _updateModalPassword: function() {
        let password = this.get('model.password');

        this.set('modalPassword', password);
        this.set('modalPasswordStatus', password === null ? 'disabled' : 'enabled');
    }
});
