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

'use strict';

const Redis = require('ioredis');
const log = require('./log');
const conf = require('./conf');

const activeClients = [];

exports.createClient = function createClient(options) {
    return createRedisClient(options);
};

exports.shutdown = function shutdown() {
    log.info(`Closing ${activeClients.length} redis connections`);

    activeClients.forEach(client => client.quit());
};

function createRedisClient({ autoClose = true } = {}) {
    const connType = conf.get('redis:connection_type');
    const client = new Redis({
        port: conf.get('redis:port'),
        host: conf.get('redis:host'),
        password: conf.get('redis:password') || null,
        path: connType === 'socket' ? null : conf.get('redis:unix_socket_path'),
        retryStrategy: times => Math.min(times * 500, 2000)
    });

    client.__quit = client.quit;

    client.quit = function quit() {
        const index = activeClients.indexOf(client);

        if (index > -1) {
            activeClients.splice(index, 1);
        }

        return client.__quit();
    };

    if (autoClose) {
        activeClients.push(client);
    }

    return client;
}
