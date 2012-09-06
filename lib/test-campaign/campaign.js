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

var Logger = require('../logging/logger.js');
var connect = require('connect');
var Coverage = require('./coverage.js');
var Resources = require('../resources.js');
var Browser = require('./browser.js');
var AllTests = require('../test-type/all-tests.js');
var util = require("util");
var pathUtils = require("path");
var events = require("events");
var coverageServer = require('node-coverage').admin;

var pad2 = function (number) {
    var res = number + "";
    if (res.length == 1) {
        return "0" + res;
    } else {
        return res;
    }
};

var createCampaignId = function () {
    var date = new Date();
    return [date.getFullYear(), pad2(date.getMonth() + 1), pad2(date.getDate()), pad2(date.getHours()),
            pad2(date.getMinutes()), pad2(date.getSeconds())].join('');
};

var TestCampaign = function (config, parentLogger) {
    this.id = createCampaignId();
    this.logger = new Logger('TestCampaign', this.id, parentLogger);
    this.logger.logInfo("Initializing campaign...");

    var rootDirectory = config.rootDirectory;
    this.rootDirectory = rootDirectory;
    this.config = config;

    var browsersCfg = config.browsers || [{}];
    var browsers = [];
    for (var i = 0, l = browsersCfg.length; i < l; i++) {
        browsers[i] = new Browser(browsersCfg[i]);
    }
    this.browsers = browsers;

    var resources = new Resources({
        baseDirectory : rootDirectory,
        contexts : config.resources || {}
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
        this._coverage = coverage;
    }
    this.tests = new AllTests(this, config.tests);

    var app = connect();
    app.use(resources.pathResolver());
    if (coverage) {
        app.use(coverage.instrumentedSender());
    }
    app.use(resources.staticSender());
    app.use(this.tests.handleRequest);
    if (coverage) {
        app.use('/__atjstestrunner__/coverage', coverage.resultsSender('/__atjstestrunner__/coverage', config['coverage-reports']['json-file']));
    }

    this.handleRequest = app.handle.bind(app);
    this.tasks = [];
    this.tasksTrees = [];
    this.results = [];
    this.remainingTasks = null;
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
            event : "tasksList",
            campaignId : self.id,
            tasks : self.tasksTrees
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
    this.results.push(event);
    var eventName = event.event;
    if (eventName == "taskFinished" || eventName == "taskIgnored") {
        this.remainingTasks--;
        this.checkFinished();
    }
    this.emit('result-' + eventName, event);
    this.emit('result', event);
};

TestCampaign.prototype.checkFinished = function () {
    if (this.remainingTasks == 0 && !this.finished) {
        var self = this;
        process.nextTick(function () {
            if (self.finished) {
                return;
            }
            // this flag makes sure the campaignFinished event can be raised only once
            self.finished = true;
            self.addResult({
                event : 'campaignFinished'
            });
            self.logger.logInfo("Campaign finished.");
            self.emit('finished');
        });
    }
};

TestCampaign.prototype.addCoverageResult = function (coverage) {
    this._coverage.addResult(coverage);
};

TestCampaign.prototype.getCoverageResult = function () {
    if (this._coverage) {
        return this._coverage.getResult();
    }
};

module.exports = TestCampaign;
