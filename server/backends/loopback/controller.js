#!/usr/bin/env node --harmony
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

process.title = 'mas-loopback';

var co = require('co'),
    common = require('../../lib/common'),
    log = require('../../lib/log'),
    redisModule = require('../../lib/redis'),
    redis = redisModule.createClient(),
    courier = require('../../lib/courier').createEndPoint('loopbackparser'),
    textLine = require('../../lib/textLine'),
    windowHelper = require('../../lib/windows'),
    outbox = require('../../lib/outbox');

common.init();

co(function *() {
    yield redisModule.loadScripts();

    courier.on('send', processSend);
    courier.on('create', processCreate);
    courier.on('join', processJoin);
    courier.start();
})();

function *processSend(params) {
    var group = params.name;
    var members = yield redis.smembers('groupmembers:' + group);
    var nick = yield redis.hget('user:' + params.userId, 'nick');

    for (var i = 0; i < members.length; i++) {
        if (members[i] !== params.userId) {
            yield textLine.send(members[i], 'MAS', group, {
                nick: nick,
                cat: 'msg',
                body: params.text,
                ts: Math.round(Date.now() / 1000)
            });
        }
    }
}

function *processCreate(params) {
    var userId = params.userId;
    var groupName = params.name;
    var password = params.password;
    var existingGroup = yield redis.hgetall('group:' + groupName);

    if (existingGroup) {
        yield outbox.queue(params.userId, params.sessionId, {
            id: 'CREATE_RESP',
            status: 'error',
            errorMsg: 'A group by this name already exists. If you\'d like, you can try to join it.'
        });
        return;
    }

    // TBD Add other checks

    yield outbox.queue(params.userId, params.sessionId, {
        id: 'CREATE_RESP',
        status: 'ok'
    });

    yield redis.sadd('group:' + groupName, {
        owner: userId,
        password: password,
        apikey: ''
    });

    log.info(userId, 'Created new MAS group:' + groupName);

    yield joinGroup(params);
}

 function *processJoin(params) {
    yield outbox.queue(params.userId, params.sessionId, {
        id: 'JOIN_RESP',
        status: 'ok'
    });

    yield joinGroup(params);
 }

function *joinGroup(params) {
    var groupName = params.name;
    var createCommand = yield windowHelper.createNewWindow(params.userId, 'MAS',
        groupName, params.password, 'group');

    yield outbox.queueAll(params.userId, createCommand);
    yield redis.sadd('groupmembers:' + groupName, params.userId);
}
