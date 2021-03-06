//
//   Copyright 2015 Ilkka Oksanen <iao@iki.fi>
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

const Ipm = require('../models/ipm.js');
const PendingIpm = require('../models/pendingIpm');
const notification = require('./notification');

exports.sendAlerts = async function sendAlerts(user, sessionId) {
  const now = new Date();
  const pendingIpms = await PendingIpm.find({ userId: user.id });

  for (const pendingIpm of pendingIpms) {
    const ipm = await Ipm.fetch(pendingIpm.get('ipmId'));

    // create-alert deletes expired alerts lazily

    if (ipm && ipm.get('expiresAt') > now) {
      await notification.send(user, sessionId, {
        type: 'ADD_ALERT',
        alertId: ipm.id,
        message: ipm.get('body')
      });
    }
  }
};
