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

var TestCampaign = require('./test-campaign/campaign.js');
var TestServer = require('./test-server/server.js');
var optimist = require('optimist');
var fs = require('fs');
var yaml = require('js-yaml');
var Logger = require('./logging/logger.js');
var ConsoleLogger = require('./logging/console-logger.js');
var ConsoleReport = require('./reports/console-report.js');
var JsonConsole = require('./reports/json-console.js');
var JsonReport = require('./reports/json-report.js');
var JsonLogReport = require('./reports/json-log-report.js');
var colors = require('colors');
var writeReports = require('./reports/write-reports.js');
var merge = require('./merge.js');
var childProcesses = require('./child-processes');
var exitProcess = require('./exit-process.js');

var readConfigFile = function (configFile, logger) {
    var configFileContent;
    try {
        configFileContent = fs.readFileSync(configFile, "utf8");
    } catch (e) {
        logger.logError("Error while opening the configuration file: %s", [e]);
        return false;
    }
    try {
        return (/\.ya?ml$/i).test(configFile) ? yaml.load(configFileContent) : JSON.parse(configFileContent);
    } catch (e) {
        logger.logError("Unable to parse configuration file %s : %s", [configFile, e]);
        return false;
    }
};

var run = function () {
    var opt = optimist.usage('Usage: $0 [options] [config.yml|config.json]').boolean(['json-console', 'help', 'server-only', 'version', 'colors', 'ignore-errors', 'ignore-failures']).string(['phantomjs-path']).describe({
        'log-level': 'Level of logging: integer from 0 (no logging) to 4 (debug).',
        'port': 'Port used for the web server. If set to 0, an available port is automatically selected.',
        'json-console': 'When enabled, JSON objects will be sent to stdout to provide information about tests.',
        'heartbeats': 'Delay (in ms) for heartbeats messages sent when --json-console is enabled. Use 0 to disable them.',
        'server-only': 'Only starts the web server, and configure it for the test campaign but do not start the campaign.',
        'phantomjs-instances': 'Number of instances of PhantomJS to start.',
        'phantomjs-path': 'Path to PhantomJS executable.',
        'browser': 'Path to any browser executable to execute the tests. Can be repeated multiple times.',
        'ignore-errors': 'When enabled, test errors (not including failures) will not cause this process to return a non-zero value.',
        'ignore-failures': 'When enabled, test failures (anticipated errors) will not cause this process to return a non-zero value.',
        'help': 'Displays this help message and exits.',
        'colors': 'Uses colors (disable with --no-colors).',
        'version': 'Displays the version number and exits.'
    }).alias({
        'j': 'json-console',
        'p': 'port'
    })['default']({
        'heartbeats': 2000,
        'port': 0,
        'log-level': 3,
        'colors': true,
        'phantomjs-instances': process.env.npm_package_config_phantomjsInstances || 0,
        'phantomjs-path': 'phantomjs',
        'ignore-errors': false,
        'ignore-failures': false
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

    var configData = {
        'coverage': null,
        'resources': {
            '/': []
        },
        'test-reports': {
            'json-log-file': [],
            'json-file': [],
            'xml-file': [],
            'xml-directory': []
        },
        'coverage-reports': {
            'json-file': [],
            'lcov-file': []
        }
    };
    var configFile = argv._[0];
    if (configFile) {
        configFile = readConfigFile(configFile, logger);
        if (configFile === false) {
            return;
        }
        merge(configData, configFile);
    }

    if (argv.config) {
        var argvResources = argv.config.resources;
        if (argvResources) { // "array-ify" entries in resources so they can get merged properly
            for (var key in argvResources) {
                if (argvResources.hasOwnProperty(key) && !Array.isArray(argvResources[key])) {
                    argvResources[key] = [argvResources[key]];
                }
            }
        }

        merge(configData, argv.config);
    }

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

    var phantomJSinstances = argv['phantomjs-instances'];
    if (phantomJSinstances > 0) {
        campaign.on('result-serverAttached', function (event) {
            var path = argv['phantomjs-path'];
            var args = event.phantomJS;
            var spawn = childProcesses.spawn;
            for (var i = 0; i < phantomJSinstances; i++) {
                var curProcess = spawn(path, args, {
                    stdio: "pipe"
                });
                curProcess.stdout.pipe(process.stdout);
                curProcess.stderr.pipe(process.stderr);
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
            process.stdout.setMaxListeners(256); // so that phantomJSinstances can be > 10
            process.stderr.setMaxListeners(256);
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
            logger.logInfo('Tests run: %d, Failures: %d, Errors: %d, Skipped: %d', [stats.testCases, stats.failures, stats.errors, stats.tasksIgnored]);
            endProcess(success);
        });
    });

    campaign.init(function () {
        testServer = new TestServer({
            frozen: argv['server-only']
        }, logger);
        testServer.server.on('error', function (error) {
            testServer.logger.logError('Web server error: %s', [error]);
            endProcess();
        });
        testServer.server.listen(argv.port, function () {
            testServer.addCampaign(campaign);
        });
    });

};

module.exports = run;