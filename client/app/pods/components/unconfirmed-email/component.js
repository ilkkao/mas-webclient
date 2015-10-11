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

/* globals $ */

import Ember from 'ember';
import { dispatch } from '../../../utils/dispatcher';

export default Ember.Component.extend({
    store: Ember.inject.service(),

    classNames: [ 'flex-row', 'unconfirmed-email' ],

    email: Ember.computed.alias('store.settings.email'),
    emailConfirmed: Ember.computed.alias('store.settings.emailConfirmed'),

    actions: {
        requestConfirmation() {
            dispatch('CONFIRM_EMAIL');
        },

        openModal(modal) {
            dispatch('OPEN_MODAL', { name: modal });
        }
    }
});
