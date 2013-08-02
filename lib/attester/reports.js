/*
 * Copyright 2013 Amadeus s.a.s.
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

var Q = require('q');

var JsonConsole = require("../reports/json-console.js");
var JsonReport = require("../reports/json-report.js");
var ConsoleReport = require("../reports/console-report.js");
var JsonLogReport = require("../reports/json-log-report.js");
var ConsoleLogger = require("../logging/console-logger.js");

var attester = require("../attester");
var config = attester.config;

var writeReports = require("../reports/write-reports.js");

/**
 * This module handles the reports creation and communication with attester.
 * There are two types of reports
 * - global, these are the one reporting any activity on attester
 * - campaign, reports specific to a certain campaign
 *
 * The module listen to events raised by attester to initialize reports and listen to the results
 */

var globalReports = [];
// The console logger is a global report that wants to be cleaned before exiting
var consoleLogger;

exports.__init__ = function () {
    attester.event.once("attester.config.available", createGlobals);
    attester.event.on("attester.result", receiveResult);
    attester.event.on("attester.campaign.created", createCampaignReports);
};

/**
 * Write the reports for the given campaign. This generates all the files specified in the campaign
 * configuration so it can be asynchronous.
 *
 * The callback is called with a success boolean, true if there where no remarkable errors or failures
 */
exports.writeReports = function (campaign, callback) {
    writeReports({
        test: campaign.config["test-reports"],
        coverage: campaign.config["coverage-reports"]
    }, {
        test: campaign.jsonReport,
        coverage: campaign.getCoverageResult()
    }, function (error) {
        if (error) {
            attester.event.emit("reports.error", "An error occurred while writing reports: " + error);
            return;
        }
        var ignoreErrors = attester.config['ignore-errors'];
        var ignoreFailures = attester.config['ignore-failures'];
        var stats = campaign.jsonReport.stats;
        var success = (ignoreErrors || stats.errors === 0) && (ignoreFailures || stats.failures === 0);

        logSummary(stats);
        logErrorsSummary(campaign.jsonReport.tasksErrors);

        attester.event.emit("reports.stats", stats);

        callback(success);
    });
};

function logSummary(stats) {
    var msg = 'Tests run: ' + stats.testCases + ', ';
    var msgFailures = stats.failures ? ('Failures: ' + stats.failures + ', ').red.bold : 'Failures: 0, '.green;
    var msgErrors = stats.errors ? ('Errors: ' + stats.errors + ', ').red.bold : 'Errors: 0, '.green;
    var msgSkipped = stats.tasksIgnored ? ('Skipped: ' + stats.tasksIgnored).yellow.bold : 'Skipped: 0'.green;
    attester.logger.logInfo(msg + msgFailures + msgErrors + msgSkipped);
}

function logErrorsSummary(tasksErrors) {
    var browsersWithErrors = Object.keys(tasksErrors);
    if (browsersWithErrors.length === 0) {
        return;
    }

    attester.logger.logInfo("------------------------");
    attester.logger.logInfo("Errors and failures summary:".yellow);
    browsersWithErrors.forEach(function (browserName) {
        var errors = tasksErrors[browserName];
        errors.sort(taskComparator);

        attester.logger.logInfo((browserName + " (" + errors.length + "):").yellow);
        errors.forEach(function (item) {
            attester.logger.logError(item.taskName + ": " + item.method);
            attester.logger.logInfo(" " + item.errorMessage.white);
        });
    });
    attester.logger.logInfo("------------------------");
}

// Create all global reports, generic for attester

function createGlobals() {
    if (config["json-console"]) {
        var jsonConsole = new JsonConsole(process.stdout, config.heartbeats);
        process.stdout.on("error", function () {
            // the process listening on this stream was closed
            attester.event.emit("reports.error", "process.stdout raised an error in JsonConsole report");
        });
        process.stdout = process.stderr;
        console.log = console.warn;
        globalReports.push(jsonConsole);
    }

    attester.logger.logLevels["."] = config["log-level"];
    if (!consoleLogger) {
        consoleLogger = new ConsoleLogger(process.stdout);
        consoleLogger.attach(attester.logger);
    }
}

function createCampaignReports(campaign) {
    var jsonReport = new JsonReport();
    campaign.on("result", jsonReport.addResult.bind(jsonReport));
    campaign.jsonReport = jsonReport;

    var consoleReport = new ConsoleReport(attester.logger, campaign, config["slow-test-threshold"]);
    campaign.on("result", consoleReport.addResult.bind(consoleReport));

    var logReports = campaign.config["test-reports"]["json-log-file"];
    logReports.forEach(function (logReport) {
        var report = new JsonLogReport(logReport);
        campaign.on("result", report.addResult.bind(report));
    });
}


// Receive a result event either from attester itself or from one of the campaigns
// This method dispatches events to the interested reports

function receiveResult(event) {
    globalReports.forEach(function (report) {
        report.addResult(event);
    });
}

function taskComparator(el1, el2) {
    if (el1.taskName > el2.taskName) {
        return 1;
    } else if (el1.taskName < el2.taskName) {
        return -1;
    } else {
        return 0;
    }
}

exports.__reset__ = function () {
    attester.event.off("attester.config.available", createGlobals);
    attester.event.off("attester.result", receiveResult);
    attester.event.off("attester.campaign.created", createCampaignReports);
    globalReports = [];

    attester.logger.logDebug("__reset__ reports done");
    return Q();
};