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
var colors = require('colors');
var portfinder = require('portfinder');

var TestCampaign = require('./test-campaign/campaign.js');
var TestServer = require('./test-server/server.js');
var Logger = require('./logging/logger.js');
var ConsoleLogger = require('./logging/console-logger.js');
var ConsoleReport = require('./reports/console-report.js');
var JsonConsole = require('./reports/json-console.js');
var JsonReport = require('./reports/json-report.js');
var JsonLogReport = require('./reports/json-log-report.js');

var writeReports = require('./reports/write-reports.js');
var childProcesses = require('./child-processes.js');
var exitProcess = require('./exit-process.js');
var config = require('./config.js');
var optimizeParallel = require('./optimize-parallel.js');

var run = function () {
    var opt = optimist.usage('Usage: $0 [options] [config.yml|config.json]').boolean(['flash-policy-server', 'json-console', 'help', 'server-only', 'version', 'colors', 'ignore-errors', 'ignore-failures']).string(['phantomjs-path']).describe({
        'browser': 'Path to any browser executable to execute the tests. Can be repeated multiple times.',
        'colors': 'Uses colors (disable with --no-colors).',
        'env': 'Environment configuration file. This file is available in the configuration object under env.',
        'flash-policy-port': 'Port used for the built-in Flash policy server (needs --flash-policy-server). Can be 0 for a random port.',
        'flash-policy-server': 'Whether to enable the built-in Flash policy server.',
        'heartbeats': 'Delay (in ms) for heartbeats messages sent when --json-console is enabled. Use 0 to disable them.',
        'help': 'Displays this help message and exits.',
        'ignore-errors': 'When enabled, test errors (not including failures) will not cause this process to return a non-zero value.',
        'ignore-failures': 'When enabled, test failures (anticipated errors) will not cause this process to return a non-zero value.',
        'json-console': 'When enabled, JSON objects will be sent to stdout to provide information about tests.',
        'log-level': 'Level of logging: integer from 0 (no logging) to 4 (debug).',
        'phantomjs-instances': 'Number of instances of PhantomJS to start.',
        'phantomjs-path': 'Path to PhantomJS executable.',
        'port': 'Port used for the web server. If set to 0, an available port is automatically selected.',
        'server-only': 'Only starts the web server, and configure it for the test campaign but do not start the campaign.',
        'version': 'Displays the version number and exits.'
    }).alias({
        'j': 'json-console',
        'p': 'port'
    })['default']({
        'colors': true,
        'flash-policy-port': 0,
        'flash-policy-server': false,
        'heartbeats': 2000,
        'ignore-errors': false,
        'ignore-failures': false,
        'log-level': 3,
        'phantomjs-instances': process.env.npm_package_config_phantomjsInstances || 0,
        'phantomjs-path': 'phantomjs',
        'port': 7777
    });
    var argv = opt.argv;
    var reports = [];
    if (argv.help) {
        opt.showHelp();
        exitProcess(0);
        return;
    }
    if (argv.version) {
        console.log(require('../package.json').version);
        exitProcess(0);
        return;
    }

    var testServer = null;
    var endProcess = function (success) {
        if (testServer) {
            testServer.close();
        }
        childProcesses.closeAll();
        exitProcess(success ? 0 : 1);
    };

    if (argv['json-console']) {
        var jsonConsole = new JsonConsole(process.stdout, argv.heartbeats);
        process.stdout.on('error', function () {
            // the process listening on this stream was closed
            endProcess();
        });
        process.stdout = process.stderr;
        console.log = console.warn;
        reports.push(jsonConsole);
    }
    colors.mode = argv.colors ? "console" : "none";

    var logger = new Logger("attester");
    logger.logLevels['.'] = argv['log-level'];
    var consoleLogger = new ConsoleLogger(process.stdout);
    consoleLogger.attach(logger);

    var configData = config.readConfig(argv._[0], argv.config, argv.env, logger);

    var campaign = new TestCampaign(configData, logger);

    var jsonReport = new JsonReport();
    reports.push(jsonReport);
    reports.push(new ConsoleReport(logger));
    var logReports = configData['test-reports']['json-log-file'];
    var i, l;
    for (i = 0, l = logReports.length; i < l; i++) {
        reports.push(new JsonLogReport(logReports[i]));
    }

    for (i = 0, l = reports.length; i < l; i++) {
        var curReport = reports[i];
        campaign.on('result', curReport.addResult.bind(curReport));
    }

    // so that (phantomjs-instances + the number of browsers) can be > 10:
    process.stdout.setMaxListeners(256);
    process.stderr.setMaxListeners(256);

    var suggestedInstances = argv['phantomjs-instances'];
    var phantomJSinstances = optimizeParallel({
        memoryPerInstance: 60,
        maxInstances: suggestedInstances
    }, logger);
    if (phantomJSinstances > 0) {
        campaign.on('result-serverAttached', function (event) {
            var path = argv['phantomjs-path'];
            var args = event.phantomJS;
            var spawn = childProcesses.spawn;
            var checkPhantomjsSpawnExitCode = function (code) {
                if (code === 127) {
                    logger.logError("Spawn: exited with code 127. PhantomJS executable not found. Make sure to download PhantomJS and add its folder to your system's PATH, or pass the full path directly to Attester via --phantomjs-path.\nUsed command: '" + path + "'");
                } else if (code === 126) {
                    logger.logError("Spawn: exited with code 126. Unable to execute PhantomJS. Make sure to have proper read & execute permissions set.\nUsed command: '" + path + "'");
                } else if (code !== 0) {
                    logger.logError("Spawn: PhantomJS exited with code " + code);
                }
            };
            for (var i = 0; i < phantomJSinstances; i++) {
                var curProcess = spawn(path, args, {
                    stdio: "pipe"
                });
                curProcess.stdout.pipe(process.stdout);
                curProcess.stderr.pipe(process.stderr);
                curProcess.on('exit', checkPhantomjsSpawnExitCode);
            }
        });
    }

    var browsers = argv.browser;
    if (browsers) {
        if (!Array.isArray(browsers)) {
            browsers = [browsers];
        }
        campaign.on('result-serverAttached', function (event) {
            var args = [event.slaveURL];
            var spawn = childProcesses.spawn;
            for (var i = 0, l = browsers.length; i < l; i++) {
                var curProcess = spawn(browsers[i], args, {
                    stdio: "pipe"
                });
                curProcess.stdout.pipe(process.stdout);
                curProcess.stderr.pipe(process.stderr);
            }
        });
    }

    campaign.on('finished', function () {
        writeReports({
            test: configData['test-reports'],
            coverage: configData['coverage-reports']
        }, {
            test: jsonReport,
            coverage: campaign.getCoverageResult()
        }, function (err) {
            if (err) {
                logger.logError('An error occurred while writing reports: %s', err);
                endProcess();
                return;
            }
            var ignoreErrors = argv['ignore-errors'];
            var ignoreFailures = argv['ignore-failures'];
            var stats = jsonReport.stats;
            var success = (ignoreErrors || stats.errors === 0) && (ignoreFailures || stats.failures === 0);

            var msg = 'Tests run: ' + stats.testCases + ', ';
            var msgFailures = stats.failures ? ('Failures: ' + stats.failures + ', ').red.bold : 'Failures: 0, '.green;
            var msgErrors = stats.errors ? ('Errors: ' + stats.errors + ', ').red.bold : 'Errors: 0, '.green;
            var msgSkipped = stats.tasksIgnored ? ('Skipped: ' + stats.tasksIgnored).yellow.bold : 'Skipped: 0'.green;
            logger.logInfo(msg + msgFailures + msgErrors + msgSkipped);

            endProcess(success);
        });
    });

    campaign.init(function () {
        testServer = new TestServer({
            frozen: argv['server-only'],
            flashPolicyPort: argv['flash-policy-port'],
            flashPolicyServer: argv['flash-policy-server']
        }, logger);
        testServer.server.on('error', function (error) {
            testServer.logger.logError('Web server error: %s', [error]);
            endProcess();
        });

        portfinder.basePort = argv.port;
        portfinder.getPort(function (err, port) {
            if (err) {
                logger.logError("Can't start the server: " + err);
                endProcess();
                return;
            }
            if (port != argv.port && argv.port > 0) {
                // logging error instead of a warning so it's more visible in the console
                logger.logError("Port %d unavailable; using %d instead.", [argv.port, port]);
            }
            testServer.server.listen(port, function () {
                testServer.addCampaign(campaign);
            });
        });
    });

};

module.exports = run;