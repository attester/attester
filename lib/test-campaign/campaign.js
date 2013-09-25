/*
 * Copyright 2012 Amadeus s.a.s. Licensed under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

var util = require("util");
var pathUtils = require("path");
var events = require("events");

var connect = require('connect');
var coverageServer = require('node-coverage').admin;

var Logger = require('../logging/logger.js');
var Coverage = require('./coverage.js');
var Resources = require('../resources.js');
var Browser = require('./browser.js');
var AllTests = require('../test-type/all-tests.js');

var pad2 = function (number) {
    var res = number + "";
    if (res.length == 1) {
        return "0" + res;
    } else {
        return res;
    }
};

var createCampaignId = function (date) {
    return [date.getFullYear(), pad2(date.getMonth() + 1), pad2(date.getDate()), pad2(date.getHours()), pad2(date.getMinutes()), pad2(date.getSeconds())].join('');
};

var TestCampaign = function (config, parentLogger) {
    this.startTime = new Date();
    this.campaignNumber = config.campaignNumber;
    this.id = createCampaignId(this.startTime);
    this.baseURL = "/campaign" + (config.predictableUrls ? this.campaignNumber : this.id);
    this.logger = new Logger('TestCampaign', this.id, parentLogger);
    this.logger.logInfo("Initializing campaign...");

    var rootDirectory = config.rootDirectory || "";
    this.rootDirectory = rootDirectory;
    this.config = config;

    if (config.browsers && config.browsers.length > 0) {
        this.logger.logInfo("Expecting the following browsers to connect: ");
    } else {
        this.logger.logInfo("No specific browsers expected in the campaign");
    }
    var browsersCfg = config.browsers || [{}]; // if no browsers required, we create one, unrestricted
    var browsers = [];
    for (var i = 0, l = browsersCfg.length; i < l; i++) {
        browsers[i] = new Browser(browsersCfg[i]);
        if (browsers[i].name) {
            this.logger.logInfo("- " + browsers[i].name);
        }
    }
    this.browsers = browsers;

    var resources = new Resources({
        baseDirectory: rootDirectory,
        contexts: config.resources || {}
    }, this.logger);
    this.resources = resources;

    var coverage = null;
    var coverageConfig = config.coverage;
    if (coverageConfig) {
        if (!coverageConfig.files) {
            coverageConfig.files = {};
        }
        coverageConfig.files.rootDirectory = pathUtils.resolve(rootDirectory, coverageConfig.files.rootDirectory);
        coverage = new Coverage(coverageConfig);
        this.coverage = coverage;
    }

    this.tests = new AllTests(this, config.tests, this.logger);

    var app = connect();
    app.use(resources.pathResolver());
    if (coverage) {
        app.use(coverage.instrumentedSender());
    }
    app.use(resources.staticSender());
    app.use(this.tests.handleRequest);
    if (coverage) {
        app.use('/__attester__/coverage/display', coverage.resultsSender(this.baseURL + '/__attester__/coverage/display', config['coverage-reports']['json-file']));
    }

    this.handleRequest = app.handle.bind(app);
    this.tasks = [];
    this.tasksTrees = [];
    this.remainingTasks = null;
    this.remainingCoverageResults = 0;
    this.finished = false;
};

util.inherits(TestCampaign, events.EventEmitter);

TestCampaign.prototype.init = function (callback) {
    // fills the array of tasks
    var self = this;
    this.tests.init(function () {
        self.tasks = self.tests.tasks;
        self.tasksTrees = self.tests.tasksTrees;
        self.remainingTasks = self.tasks.length;
        callback();
        self.addResult({
            event: "tasksList",
            campaignId: self.id,
            tasks: self.tasksTrees
        });
        var initResults = self.tests.initResults;
        for (var i = 0, l = initResults.length; i < l; i++) {
            self.addResult(initResults[i]);
        }
    });
};

TestCampaign.prototype.addResult = function (event) {
    if (!event.time) {
        event.time = new Date().getTime();
    }
    var eventName = event.event;
    if (eventName == "coverage") {
        this.remainingCoverageResults++;
    } else if (eventName == "taskFinished" || eventName == "taskIgnored") {
        this.remainingTasks--;
        this.checkFinished();
    }
    event.remainingTasks = this.remainingTasks;
    this.emit('result-' + eventName, event);
    this.emit('result', event);
};

TestCampaign.prototype.checkFinished = function () {
    if (this.remainingTasks === 0 && this.remainingCoverageResults === 0 && !this.finished) {
        var self = this;
        process.nextTick(function () {
            if (self.finished) {
                return;
            }
            // this flag makes sure the campaignFinished event can be raised only once
            self.finished = true;
            self.addResult({
                event: 'campaignFinished'
            });
            var elapsed = self.getElapsedTime();
            self.logger.logInfo("Campaign finished. Time: %dmin %dsec", [elapsed.min, elapsed.sec]);
            self.emit('finished');
        });
    }
};

TestCampaign.prototype.addCoverageResult = function (taskId, coverage) {
    // taskId is not used currently, but it would be possible in the future to keep the link between a coverage result
    // and the test which produced it, or perhaps to build, for each file, the list of tests which use it
    this.coverage.addResult(coverage);
    this.remainingCoverageResults--;
    this.checkFinished();
};

TestCampaign.prototype.getCoverageResult = function () {
    if (this.coverage) {
        return this.coverage.getResult();
    }
};

TestCampaign.prototype.getElapsedTime = function () {
    var elapsedSec = Math.ceil((new Date() - this.startTime) / 1000);
    var elapsedMin = Math.floor(elapsedSec / 60);
    elapsedSec = elapsedSec % 60;
    return {
        min: elapsedMin,
        sec: elapsedSec
    };
};

module.exports = TestCampaign;