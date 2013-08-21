//
//   Copyright 2009-2013 Ilkka Oksanen <iao@iki.fi>
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

qx.Class.define('mas.CreateDialog', {
    extend: mas.Dialog,

    construct: function() {
        this.base(arguments);
    },

    properties: {
        createCb: {
            init: null
        }
    },

    members: {
        open: function() {
            var nameField = new qx.ui.form.TextField().set({
                maxLength: 25
            });
            var pwField = new qx.ui.form.TextField().set({
                maxLength: 25
            });

            this.setYesLabel('OK');
            this.setNoLabel('Cancel');

            this.setCaption('Create new group');
            this.setText('Type the name of the group you wish to create:');

            var that = this;

            var process = function() {
                var name = nameField.getValue();
                var pw = pwField.getValue();

                if (name !== '') {
                    that.getCreateCb()(name, pw);
                }
            };

            this.setYesCb(function() {
                process();
            });

            this.base(arguments);

            // Add more fields
            this.addAt(nameField, 1);
            this.addAt(new qx.ui.basic.Label('Password (optional):'), 2);
            this.addAt(pwField, 3);

            var keyPressed = function(e) {
                if (e.getKeyIdentifier() === 'Enter') {
                    process();
                }
            };

            nameField.addListener('keypress', keyPressed);
            pwField.addListener('keypress', keyPressed);
        }
    }
});
