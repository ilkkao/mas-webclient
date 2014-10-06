#!/usr/bin/env node
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

var child = require('child_process'),
    fs = require('fs'),
    path = require('path'),
    semver = require('semver'),
    yargs = require('yargs'),
    nconf = require('nconf'),
    mkdirp = require('mkdirp');

require('colors');

var argv = yargs
    .usage('Usage: $0 start|stop|restart|status')
    .demand(1, 'Action (start, stop, restart, or status) missing.')
    .alias('f', 'configFile')
    .describe('f', 'Configuration file.')
    .default('f', 'mas.conf')
    .boolean('c')
    .alias('c', 'connman')
    .describe('c', 'Also start, stop or restart IRC connman process.')
    .default('c', false)
    .boolean('b')
    .alias('b', 'background')
    .describe('b', 'Daemonize MAS processes')
    .default('b', false)
    .help('h')
    .alias('h', 'help')
    .version('0.0.1', 'v')
    .alias('v', 'version')
    .argv;

checkNodeVersion();
setupNconf();

var action = argv._[0];
var env = getConfigOption('common:env');
var pidDir = getConfigOption('pid:directory');
var logDir = getConfigOption('log:directory');

mkdirp.sync(getAbsolutePath(logDir)); // Make sure logs directory exists

var processes = {
    'mas-frontend': 'server.js',
    'mas-irc': 'backends/irc/controller.js',
    'mas-loopback': 'backends/loopback/controller.js'
};

if (argv.connman === true || action === 'status') {
    processes['irc-connman'] = 'backends/irc/connectionManager.js';
}

console.log('MAS env: ' + env.yellow);

if (action === 'stop' || action === 'restart') {
    stopProcesses();
}

if (action === 'start' || action === 'restart') {
    startProcesses();
}

if (action === 'status') {
    monitorProcesses();
}

function stopProcesses() {
    for (var component in processes) { /*jshint forin: false */
        var pid = getComponentPid(component);

        if (pid !== 0) {
            process.kill(pid);
            console.log('Stopped:'.red + ' ' + component);
        } else {
            console.log('Was not running:'.red + ' ' + component);
        }
    }
}

function startProcesses() {
    for (var component in processes) { /*jshint forin: false */
        var spawnOptions = {
            detached: argv.background,
            stdio: argv.background ? 'ignore' : null
        };

        var commandLineParameters = [
            '--harmony',
            getAbsolutePath(path.join('server', processes[component])),
            '--configFile',
            argv.configFile
        ];

        var node = child.spawn('node', commandLineParameters, spawnOptions);

        if (argv.background) {
            node.unref();
        } else {
            node.stdout.on('data', printChildOutput);
            node.stderr.on('data', printChildOutput);
            node.on('close', handleClose);
        }

        console.log('Starting:'.green + ' ' + component);
    }
}

function monitorProcesses() {
    for (var component in processes) { /*jshint forin: false */
        var pid = getComponentPid(component);

        if (pid !== 0) {
            console.log(component + ': ' + 'running'.green + ', pid: ' + pid);
        } else {
            console.log(component + ': ' + 'stopped'.red);
        }
    }
}

function getComponentPid(component) {
    var pidFile = path.join(getAbsolutePath(pidDir), component + '-' + env + '.pid');
    var pid = 0;

    if (fs.existsSync(pidFile)) {
        pid = parseInt(fs.readFileSync(pidFile));

        try {
            process.kill(pid, 0);
        } catch (e) {
            pid = 0;
            console.log('Process ' + component + ' (pid: ' + pid +
                ') was not running even the PID file existed.');
            fs.unlinkSync(pidFile);
        }
    }

    return pid;
}

function handleClose(code) {
    console.log('One of the MAS processes terminated (code: ' + code + '). Stopping all of them.');
    process.exit(1);
}

function checkNodeVersion() {
    if (semver.lt(process.version, 'v0.11.11')) {
        console.log('ERROR: Installed Node.js version must be at least v0.11.11');
        process.exit(1);
    }
}

function setupNconf() {
    var configFile = getAbsolutePath(argv.configFile);

    if (!fs.existsSync(configFile)) {
        console.error('ERROR: '.red + 'Config file ' + configFile + ' missing.');
        process.exit(1);
    }

    nconf.use('file', {
        file: configFile,
        format: nconf.formats.ini
    });
}

function getConfigOption(key) {
    var value = nconf.get(key);

    if (value === undefined) {
        console.error('ERROR: '.red + 'Config variable missing in the config file: ' + key);
        process.exit(1);
    }

    return value;
}

function getAbsolutePath(origPath) {
    var ROOTPATH = path.join(__dirname, '..');

    if (origPath.charAt(0) === path.sep) {
        return path.normalize(origPath); // Absolute path
    } else {
        return path.join(ROOTPATH, origPath);
    }
}

function printChildOutput(text) {
    process.stdout.write(text);
}
