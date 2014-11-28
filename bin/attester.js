#!/usr/bin/env node
/*
 * Copyright 2012 Amadeus s.a.s.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var optimist = require('optimist');

var exitProcess = require('exit');
var attester = require('../lib/attester.js');
var merge = require('../lib/util/merge.js');

var opt = optimist.usage('Usage: $0 [options] [config.yml|config.json]').boolean(['flash-policy-server', 'json-console', 'help', 'live-results', 'server-only', 'version', 'colors', 'ignore-errors', 'ignore-failures', 'shutdown-on-campaign-end', 'predictable-urls']).string(['phantomjs-path']).describe({
    'colors': 'Uses colors (disable with --no-colors).',
    'env': 'Environment configuration file. This file is available in the configuration object under env.',
    'heartbeats': 'Delay (in ms) for heartbeats messages sent when --json-console is enabled. Use 0 to disable them.',
    'help': 'Displays this help message and exits.',
    'ignore-errors': 'When enabled, test errors (not including failures) will not cause this process to return a non-zero value.',
    'ignore-failures': 'When enabled, test failures (anticipated errors) will not cause this process to return a non-zero value.',
    'json-console': 'When enabled, JSON objects will be sent to stdout to provide information about tests.',
    'live-results': 'When enabled (which is the default), it is possible to connect to attester with an external program to get live test results.',
    'log-level': 'Level of logging: integer from 0 (no logging) to 4 (debug).',
    'max-task-restarts': 'Maximum number of times a task can be restarted (after being interrupted by a browser disconnection).',
    'phantomjs-instances': 'Number of instances of PhantomJS to start.',
    'phantomjs-path': 'Path to PhantomJS executable.',
    'port': 'Port used for the web server. If set to 0, an available port is automatically selected.',
    'predictable-urls': 'If true, resources served by the campaign have predictable URLs (campaign1, campaign2...). Otherwise, the campaign part in the URL is campaign ID. Useful for debugging.',
    'robot-browser': 'Specifies the browser that should be automatically started by the selenium-java-robot (either Firefox, Chrome, Safari or Internet Explorer).',
    'run-browser': 'Path to any browser executable to execute the tests. Can be repeated multiple times.',
    'server-only': 'Only starts the web server, and configure it for the test campaign but do not start the campaign.',
    'shutdown-on-campaign-end': 'Once the campaign is finished, shut down the server and exit the process. Set this to false to facilitate debugging.',
    'slow-test-threshold': 'Threshold (in milliseconds) to mark long-running tests in the console report. Use 0 to disable.',
    'task-restart-on-failure': 'When enabled, failing tasks are restarted as if the browser was disconnected.',
    'task-timeout': 'Timeout of a task execution in milliseconds.',
    'version': 'Displays the version number and exits.'
}).alias({
    'j': 'json-console',
    'p': 'port'
})['default'](attester.config.getDefaults());

var argv = opt.argv;
if (argv.help) {
    opt.showHelp();
    exitProcess(0);
    return;
}
if (argv.version) {
    console.log(attester.package.version);
    exitProcess(0);
    return;
}

/**
 * When attester is called from the command line we should also exit the proces when
 * everything is done
 */
attester.event.once("attester.core.idle", finish);
attester.event.once("attester.core.fail", fail);

function finish() {
    checkConfigAndEndProcess(0);
}

function fail() {
    checkConfigAndEndProcess(1);
}

function checkConfigAndEndProcess(code) {
    if (attester.config["shutdown-on-campaign-end"]) {
        endProcess(code);
    } else {
        attester.logger.logInfo("Idle; press CTRL-C to end the process.");
    }
}

function endProcess(code) {
    attester.dispose().then(function () {
        attester.logger.logDebug("Attester disposed, exiting with code " + code);
        exitProcess(code);
    });
}

// Global configuration for attester
var filtered = {};
// Don't really care about these options because they are alias or handled differently
merge(filtered, argv, ["j", "p", "version", "help", "_", "env", "config", "$0"]);
if (argv.env) {
    filtered.env = attester.config.readFile(argv.env);
}
attester.config.set(filtered);

// argv._ is an array of file names to read campaign information from
if (argv._.length === 0) {
    // Didn't specify a file, run a campaign with values from the config
    attester.campaign.create({}, argv.config, 1);
} else {
    argv._.forEach(function (campaign, n) {
        attester.campaign.create(attester.config.readFile(campaign), argv.config, n+1);
    });
}

attester.start();
