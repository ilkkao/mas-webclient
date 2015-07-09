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

'use strict';

const redis = require('../lib/redis').createClient(),
      settings = require('../models/settings');

exports.show = function*() {
    let token = this.params.token;
    let userId = yield redis.get(`emailconfirmationtoken:${token}`);

    if (!userId) {
        this.body = 'Expired or invalid email confirmation link.';
        return;
    }

    yield redis.hset(`user:${userId}`, 'emailConfirmed', 'true');
    yield settings.sendSet(userId);

    yield this.render('confirmed-email', {
        page: 'confirmed-email',
        title: 'Email confirmed'
    });
};