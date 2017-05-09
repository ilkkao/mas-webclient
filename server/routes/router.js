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

const path = require('path');
const Router = require('koa-router');
const send = require('koa-send');
const proxy = require('koa-proxy');
const body = require('koa-body');
const convert = require('koa-convert');
const conf = require('../lib/conf');
const log = require('../lib/log');
const passport = require('../lib/passport');
const registerController = require('../controllers/register');
const loginController = require('../controllers/login');
const websiteController = require('../controllers/website');
const uploadController = require('../controllers/upload');
const userFilesController = require('../controllers/userFiles');
const forgotPasswordController = require('../controllers/forgotPassword');
const confirmEmailController = require('../controllers/confirmEmail');

const ONE_YEAR_IN_MS = 1000 * 60 * 60 * 24 * 365;
const TWO_DAYS_IN_MS = 1000 * 60 * 60 * 24 * 2;
const fingerPrintRe = /^assets\/\S+-.{32}\.\w+$/;
const devMode = process.env.NODE_ENV !== 'production';

const newClientDevProxy = convert(proxy({
    host: 'http://localhost:8080',
    map: urlPath => (urlPath === '/sector17' ? '/sector17/' : urlPath)
}));

module.exports = function buildRouter() {
    log.info('Registering website routes');

    const router = new Router();

    // Passport authentication routes
    if (conf.get('googleauth:enabled') && conf.get('googleauth:openid_realm')) {
        router.get('/auth/google', passport.authenticate('google', {
            scope: 'email profile',
            openIDRealm: conf.get('googleauth:openid_realm')
        }));
        router.get('/auth/google/oauth2callback', loginController.externalLogin('google'));
    }

    if (conf.get('yahooauth:enabled')) {
        router.get('/auth/yahoo', passport.authenticate('yahoo'));
        router.get('/auth/yahoo/callback', loginController.externalLogin('yahoo'));
    }

    if (conf.get('cloudronauth:enabled')) {
        router.get('/auth/cloudron', passport.authenticate('cloudron'));
        router.get('/auth/cloudron/callback', loginController.externalLogin('cloudron'));
    }

    router.post('/login', body(), loginController.localLogin);

    // File upload endpoint
    router.post('/api/v1/upload', body({ multipart: true }), uploadController);

    // Registration routes
    router.get('/register', registerController.index);
    router.post('/register', body(), registerController.create);
    router.post('/register-ext', registerController.createExt);
    router.post('/register-reset', registerController.createReset);

    // Forgot password
    router.post('/forgot-password', body(), forgotPasswordController.create);
    router.get('/reset-password/:token', registerController.indexReset);

    // Confirm email
    router.get('/confirm-email/:token', confirmEmailController.show);

    // Public uploaded files
    router.get('/files/:uuid/:slug*', userFilesController);

    // Client
    router.get('/app', async ctx => {
        ctx.set('Cache-control', 'private, max-age=0, no-cache');
        await sendFile(ctx, 'client/dist/', 'index.html');
    });

    // Client assets
    router.get(/^\/app\/(.+)/, async ctx => {
        const subPath = ctx.params[0];
        let maxage = TWO_DAYS_IN_MS;

        if (devMode) {
            maxage = 0;
        } else if (fingerPrintRe.test(subPath)) {
            maxage = ONE_YEAR_IN_MS;
        }

        await sendFile(ctx, 'client/dist/', subPath, { maxage });
    });

    if (devMode) {
        // Ember CLI Live Reload redirect hack
        router.get('/ember-cli-live-reload.js', ctx =>
            ctx.redirect('http://localhost:4200/ember-cli-live-reload.js'));
    }

    // New client
    router.get(/\/sector17\/?(.*)/, async ctx => {
        const subPath = ctx.params[0];

        if (devMode) {
            await newClientDevProxy(ctx);
            ctx.set('Cache-control', 'private, max-age=0, no-cache');
        } else {
            await sendFile(ctx, 'newclient/dist/', subPath, {
                index: 'index.html',
                maxage: subPath === '' ? 0 : ONE_YEAR_IN_MS
            });
        }
    });

    // Web site pages
    router.get(/^\/(about|home|tos|pricing|support|$)\/?$/, websiteController);

    // Web site assets
    router.get(/^\/website-assets\/(.+)/, async ctx => {
        const maxage = devMode ? 0 : ONE_YEAR_IN_MS;
        await sendFile(ctx, 'server/website/dist/', ctx.params[0], { maxage });
    });

    return router;
};

async function sendFile(ctx, root, filePath, options = {}) {
    const sendOptions = Object.assign({}, options, {
        root: path.join(__dirname, `../../${root}`)
    });

    await send(ctx, filePath === '' ? '/' : filePath, sendOptions);
}