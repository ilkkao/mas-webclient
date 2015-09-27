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

/* globals moment, $ */

import Ember from 'ember';
import Users from '../utils/users';
import Window from '../models/window';
import Message from '../models/message';
import Friend from '../models/friend';
import Alert from '../models/alert';
import { calcMsgHistorySize } from '../utils/msg-history-sizer';

const modelNameMapping = {
    window: Window,
    message: Message,
    logMessage: Message,
    friend: Friend,
    alert: Alert
};

const primaryKeys = {
    window: 'windowId',
    message: 'gid',
    logMessage: 'gid',
    friend: 'userId',
    alert: 'alertId'
};

export default Ember.Service.extend({
    socket: Ember.inject.service(),

    users: null,
    friends: null,
    windows: null,
    alerts: null,
    networks: null,
    modals: null,

    settings: null,

    userId: null,
    initDone: false,
    maxBacklogMsgs: 100000,
    cachedUpto: 0,
    dayCounter: 0,

    activeDraggedWindow: false,

    init() {
        this._super();

        this.set('users', Users.create());
        this.set('friends', Ember.A([]));
        this.set('windows', Ember.A([]));
        this.set('alerts', Ember.A([]));
        this.set('networks', Ember.A([]));
        this.set('modals', Ember.A([]));

        this.set('settings', Ember.Object.create({
            theme: 'default',
            activeDesktop: null,
            email: '',
            emailConfirmed: true
        }));

        let authCookie = $.cookie('auth');

        if (!authCookie) {
            this.logout();
        }

        let [ userId, secret ] = authCookie.split('-');

        if (!userId || !secret) {
            this.logout();
        }

        this.set('userId', userId);
        this.set('secret', secret);
    },

    desktops: Ember.computed('windows.@each.desktop', 'windows.@each.newMessagesCount', function() {
        let desktops = {};
        let desktopsArray = Ember.A([]);

        this.get('windows').forEach(function(masWindow) {
            let newMessages = masWindow.get('newMessagesCount');
            let desktop = masWindow.get('desktop');
            let initials = masWindow.get('simplifiedName').substr(0, 2).toUpperCase();

            if (desktops[desktop]) {
                desktops[desktop].messages += newMessages;
            } else {
                desktops[desktop] = { messages: newMessages, initials: initials };
            }
        });

        Object.keys(desktops).forEach(function(desktop) {
            desktopsArray.push({
                id: parseInt(desktop),
                initials: desktops[desktop].initials,
                messages: desktops[desktop].messages
            });
        });

        return desktopsArray;
    }),

    deletedDesktopCheck: Ember.observer('desktops.[]', 'initDone', function() {
        if (!this.get('initDone')) {
            return;
        }

        let desktopIds = this.get('desktops').map(d => d.id);

        if (desktopIds.indexOf(this.get('settings.activeDesktop')) === -1) {
            this.changeDesktop(this._oldestDesktop());
        }
    }),

    changeDesktop(desktopId) {
        this.set('settings.activeDesktop', desktopId);

        if (!isMobile.any) {
            this.get('socket').send({
                id: 'SET',
                settings: {
                    activeDesktop: desktopId
                }
            });
        }
    },

    seekDesktop(direction) {
        let desktops = this.get('desktops');
        let index = desktops.indexOf(desktops.findBy('id', this.get('settings.activeDesktop')));

        index += direction;

        if (index === desktops.length) {
            index = 0;
        } else if (index === -1) {
            index = desktops.length - 1;
        }

        this.changeDesktop(desktops[index].id);
    },

    _oldestDesktop() {
        return this.get('desktops').map(d => d.id).sort()[0];
    },

    start() {
        let data;
        let localStorageSupported = typeof Storage !== 'undefined';

        if (localStorageSupported) {
            data = this._loadSnapshot();
        }

        if (data) {
            this.set('cachedUpto', data.cachedUpto ? data.cachedUpto : 0);
        }

        // It's now first possible time to start socket.io connection. Data from server
        // can't race with snapshot data as first socket.io event will be processed at
        // earliest in the next runloop.
        this.get('socket').start();

        if (data) {
            this._processSnapshot(data);
        }

        if (localStorageSupported) {
            setInterval(function() {
                Ember.run.next(this, this._saveSnapshot);
            }.bind(this), 60 * 1000); // Once in a minute
        }

        this._startDayChangedService();
    },

    logout() {
        $.removeCookie('auth', { path: '/' });
        window.location = '/';
    },

    insertModels(type, models, parent) {
        parent = parent || this;

        let objects = [];
        let primaryKeyName = primaryKeys[type];

        this._ensureLookupTableExists(type, parent);

        for (let data of models) {
            let object = this._createModel(type, data, parent);
            let primaryKey = data[primaryKeyName];

            objects.push(object);
            parent.lookupTable[type][primaryKey] = object;
        }

        parent.get(type + 's').pushObjects(objects);
    },

    upsertModel(type, data, parent) {
        return this._upsert(data, primaryKeys[type], type, parent || this, false);
    },

    upsertModelPrepend(type, data, parent) {
        return this._upsert(data, primaryKeys[type], type, parent || this, true);
    },

    removeModel(type, object, parent) {
        this.removeModels(type, [ object ], parent);
    },

    removeModels(type, objects, parent) {
        parent = parent || this;

        for (let object of objects) {
            let primaryKeyName = primaryKeys[type];
            let primaryKeyValue = object[primaryKeyName];

            delete parent.lookupTable[type][primaryKeyValue];
        }

        parent.get(type + 's').removeObjects(objects);
    },

    clearModels(type, parent) {
        parent = parent || this;

        if (parent.lookupTable) {
            delete parent.lookupTable[type];
        }

        parent.get(type + 's').clear();
    },

    _startDayChangedService() {
        // Day has changed service
        let timeToTomorrow = moment().endOf('day').diff(moment()) + 1;

        let changeDay = function() {
            this.incrementProperty('dayCounter');
            Ember.run.later(this, changeDay, 1000 * 60 * 60 * 24);
        };

        Ember.run.later(this, changeDay, timeToTomorrow);
    },

    _upsert(data, primaryKeyName, type, parent, prepend) {
        this._ensureLookupTableExists(type, parent);
        let object = parent.lookupTable[type][data[primaryKeyName]];

        if (object) {
            if (type === 'message' && data.status !== 'edited' && data.status !== 'deleted') {
                // Messages are immutable in this case. Avoid work and bail out early.
                return object;
            }

            delete data[primaryKeyName];
            object.setModelProperties(data);
        } else {
            object = this._insertObject(type, data, parent, prepend);
            parent.lookupTable[type][data[primaryKeyName]] = object;
        }

        return object;
    },

    _insertObject(type, data, parent, prepend) {
        let object = this._createModel(type, data, parent);
        let collection = parent.get(type + 's');

        return prepend ? collection.unshiftObject(object) : collection.pushObject(object);
    },

    _createModel(type, data, parent) {
        let object = modelNameMapping[type].create();
        object.setModelProperties(data); // Never set properties with create()

        // TBD: Add 'arrayName' parameter so that logMessage type and primary key can be removed.

        if (type === 'window' || type === 'message' || type === 'logMessage' || type === 'friend') {
            object.set('store', this);
        }

        if (type === 'window') {
            object.set('socket', this.get('socket'));
        }

        if (type === 'message' || type === 'logMessage') {
            object.set('window', parent);
        }

        return object;
    },

    _ensureLookupTableExists(type, parent) {
        if (!parent.lookupTable) {
            parent.lookupTable = {};
        }

        if (!parent.lookupTable[type]) {
            parent.lookupTable[type] = {};
        }
    },

    _saveSnapshot() {
        let cachedUpto = 0;

        if (!this.get('initDone')) {
            return;
        }

        let data = {
            windows: [],
            users: {},
            activeDesktop: this.get('activeDesktop'),
            userId: this.get('userId'),
            version: 1
        };

        let maxBacklogMsgs = calcMsgHistorySize();

        for (let masWindow of this.get('windows')) {
            let messages = [];

            let sortedMessages = masWindow.get('messages').sortBy('ts').slice(-1 * maxBacklogMsgs);

            for (let message of sortedMessages) {
                let messageData = message.getProperties([
                    'gid',
                    'body',
                    'cat',
                    'ts',
                    'updatedTs',
                    'userId',
                    'status',
                    'type',
                    'hideImages'
                ]);

                if (messageData.gid > cachedUpto) {
                    cachedUpto = messageData.gid;
                }

                if (!messageData.status || messageData.status === 'original') {
                    // Save space
                    delete messageData.status;
                    delete messageData.updatedTs;
                }

                messages.push(messageData);
                data.users[messageData.userId] = true;
            }

            let windowProperties = masWindow.getProperties([
                'windowId',
                'generation',
                'name',
                'userId',
                'network',
                'type',
                'row',
                'column',
                'desktop',
                'newMessagesCount',
                'minimizedNamesList',
                'alerts'
            ]);

            windowProperties.messages = messages;
            data.windows.push(windowProperties);
        }

        data.cachedUpto = cachedUpto;

        this.set('cachedUpto', cachedUpto);

        for (let userId of Object.keys(data.users)) {
            data.users[userId] = this.get('users.users.' + userId);
        }

        try {
            window.localStorage.setItem('data', JSON.stringify(data));
            Ember.Logger.info('Snapshot saved.');
        } catch (e) {
            Ember.Logger.info(`Failed to save snapshot: ${e}`);
        }

        this.set('cachedUpto', cachedUpto);
    },

    _loadSnapshot() {
        let data;

        Ember.Logger.info('Starting to load saved snapshot.');

        try {
            data = JSON.parse(window.localStorage.getItem('data'));

            if (!data) {
                Ember.Logger.info('Snapshot not found.');
                return false;
            }

            if (!data.activeDesktop || data.userId !== this.get('userId') || data.version !== 1) {
                Ember.Logger.info('Snapshot corrupted.');
                window.localStorage.removeItem('data');
                return false;
            }

            Ember.Logger.info('Snapshot loaded.');
        } catch (e) {
            Ember.Logger.info(`Failed to load or validate snapshot: ${e}`);
        }

        return data;
    },

    _processSnapshot(data) {
        for (let userId of Object.keys(data.users)) {
            this.set('users.users.' + userId, data.users[userId]);
        }

        this.get('users').incrementProperty('isDirty');

        for (let windowData of data.windows) {
            let messages = windowData.messages;
            delete windowData.messages;

            let windowObject = this.upsertModel('window', windowData);
            this.insertModels('message', messages, windowObject);
        }

        this.set('activeDesktop', data.activeDesktop);
        Ember.Logger.info('Snapshot processed.');
    }
});
