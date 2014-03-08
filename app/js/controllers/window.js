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

App.WindowController = Ember.ObjectController.extend({
    actions: {
        moveRowUp: function() {
            this.decrementProperty('row');
            this.set('animate', true);
        },
        moveRowDown: function() {
            this.incrementProperty('row');
            this.set('animate', true);
        },
        sendMessage: function() {
            var text = this.get('newMessage');

            App.networkMgr.send({
                command: 'SEND',
                text: text,
                windowId: this.get('windowId')
            });
            this.set('newMessage', '');

            this.get('messages').pushObject(App.Message.create({
                body: text,
                cat: 'mymsg',
                nick: App.nicks[this.get('network')],
                ts: moment().unix()
            }));
        }
    }
});
