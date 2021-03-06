//
//   Copyright 2014 Ilkka Oksanen <iao@iki.fi>
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

const notification = require('../lib/notification');
const alerts = require('../lib/alert');
const courier = require('../lib/courier').create();
const conf = require('../lib/conf');
const log = require('../lib/log');
const friendsService = require('./friends');
const settingsService = require('./settings');
const Conversation = require('../models/conversation');
const ConversationMember = require('../models/conversationMember');
const ConversationMessage = require('../models/conversationMessage');
const Window = require('../models/window');

const networkNames = ['MAS', ...Object.keys(conf.get('irc:networks')).map(nw => conf.get(`irc:networks:${nw}:name`))];

// TODO: Is courier quit() needed?

exports.init = async function init(user, session, maxBacklogLines, cachedUpto) {
  await settingsService.sendUpdateSettings(user, session.id);
  await friendsService.sendUpdateFriends(user, session.id);
  await friendsService.sendConfirmFriends(user, session.id);
  await friendsService.informStateChange(user, 'login');

  await alerts.sendAlerts(user, session.id);
  await sendNetworkList(user, session.id);

  const ntfs = [];
  const messages = [];
  const windows = await Window.find({ userId: user.id });

  for (const window of windows) {
    const conversationId = window.get('conversationId');
    const conversation = await Conversation.fetch(conversationId);

    if (!conversation) {
      log.warn(user, `Found Window object without linked conversation, id: ${window.id}`);
      continue;
    }

    const members = await ConversationMember.find({ conversationId });

    const role = members.find(member => member.get('userGId') === user.gIdString).get('role');
    let oneOnOneMember = null;

    if (conversation.get('type') === '1on1') {
      oneOnOneMember = members.find(member => member.get('userGId') !== user.gIdString);
    }

    ntfs.push({
      type: 'ADD_WINDOW',
      windowId: window.id,
      name: conversation.get('name'),
      userId: oneOnOneMember && oneOnOneMember.get('userGId'),
      windowType: conversation.get('type'),
      network: conversation.get('network'),
      password: conversation.get('password'),
      topic: conversation.get('topic'),
      alerts: {
        email: window.get('emailAlert'),
        notification: window.get('notificationAlert'),
        sound: window.get('soundAlert'),
        title: window.get('titleAlert')
      },
      row: window.get('row'),
      column: window.get('column'),
      minimizedNamesList: window.get('minimizedNamesList'),
      desktop: window.get('desktop'),
      role
    });

    ntfs.push({
      type: 'UPDATE_MEMBERS',
      windowId: window.id,
      reset: true,
      members: members.map(member => ({
        userId: member.get('userGId'),
        role: member.get('role')
      }))
    });

    const lines = await ConversationMessage.find({ conversationId: conversation.id });
    const firstBacklogMessage = lines.length - maxBacklogLines;

    const windowMessages = [];

    lines.forEach((message, index) => {
      const newMsg = index >= firstBacklogMessage && message.id > cachedUpto;
      const newEdit = message.get('status') !== 'original' && message.get('updatedId') >= cachedUpto;

      if (newMsg || newEdit) {
        windowMessages.push(message.convertToNtf());
      }
    });

    messages.push({
      windowId: window.id,
      messages: windowMessages
    });
  }

  ntfs.push({ type: 'ADD_MESSAGES', messages });
  ntfs.push({ type: 'FINISH_INIT' });
  ntfs.unshift({ type: 'STARTUP_SEQUENCE', length: ntfs.length });

  await notification.send(user, session.id, ntfs);

  // Check if the user was away too long
  courier.callNoWait('ircparser', 'reconnectifinactive', { userId: user.id });
};

async function sendNetworkList(userGId, sessionId) {
  await notification.send(userGId, sessionId, {
    type: 'UPDATE_NETWORKS',
    networks: networkNames
  });
}
