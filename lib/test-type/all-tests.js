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

var connect = require('connect');
var url = require('../util/url');
var testTypes = require('../attester/testTypes');
var Logger = require('../logging/logger.js');

var getPrototype = function (type) {
    // See if we can get it from local repository, otherwise delegate to npm
    var locals = {
        'aria-templates': './aria-templates/at-test-type',
        'mocha': './mocha/mocha-test-type'
    };

    var module = testTypes.getTestType(type);
    if (module) {
        // nothing to do
    } else if (locals.hasOwnProperty(type)) {
        module = require(locals[type]);
    } else {
        try {
            module = require('attester-' + type);
        } catch (ex) {}
    }

    if (module) {
        return module(require("../attester"));
    }
};

var AllTests = function (campaign, config, parentLogger) {
    this.logger = new Logger('AllTests', parentLogger);
    this.campaign = campaign;
    this.config = config;

    var testTypes = {};
    var app = connect();

    var testTypesCount = 0;
    for (var type in config) {
        var testTypePrototype = getPrototype(type);
        if (testTypePrototype) {
            testTypesCount++;
            var curTestType = new testTypePrototype(campaign, config[type]);
            testTypes[type] = curTestType;
            app.use(curTestType.getHandler());
        } else {
            this.logger.logWarn("Test type %s not supported in 'tests' configuration", [type]);
        }
    }
    this.testTypesCount = testTypesCount;

    this.handleRequest = app.handle.bind(app);
    this.testTypes = testTypes;
    this.tasks = [];
    this.tasksTrees = [];
    this.initResults = [];
    this.debugUrls = [];
};

var buildTask = function (testType, test, browser) {
    var taskId = this.tasks.length;
    var task = {
        taskId: taskId,
        testType: testType,
        test: test,
        browser: browser,
        slave: null
    };
    this.tasks[taskId] = task;
    var name = test.name;
    var browserName;
    if (browser.name) {
        browserName = browser.name;
        name += ' on ' + browser.name;
    }
    var testResults = test.results || (test.browserResults ? test.browserResults[browserName] : null);
    if (testResults) {
        for (var i = 0, l = testResults.length; i < l; i++) {
            var testResult = Object.assign({
                name: name
            }, testResults[i]);
            testResult.taskId = taskId;
            this.initResults.push(testResult);
        }
    } else {
        browser.addTask(task);
    }
    return {
        taskId: taskId,
        taskName: test.name,
        browserName: browserName,
        name: name
    };
};

var buildTasksForTest = function (testType, test) {
    var subTests = test.subTests;
    var testResults = test.results;
    if (!subTests && !test.url && !testResults) {
        // something is wrong with this test!!
        testResults = test.results = [{
            event: "taskStarted"
        }, {
            event: "error",
            name: test.name,
            error: {
                message: "This test does not have any url (this is probably an issue from the runner from " + testType.name + " test runner)."
            }
        }, {
            event: "taskFinished"
        }];
    }
    if (test.url) {
        // Prefix the base URL
        test.url = url.normalize(testType.getBaseURL(true), test.url);
    }
    if (subTests && !testResults) {
        // test suite
        return {
            name: test.name,
            subTasks: buildTasksArrays.call(this, testType, subTests)
        };
    } else {
        var browsers = this.campaign.browsers;
        var browsersCount = browsers.length;
        if (browsersCount > 1) {
            var tasks = [];
            for (var j = 0; j < browsersCount; j++) {
                tasks[j] = buildTask.call(this, testType, test, browsers[j]);
            }
            return {
                name: test.name,
                subTasks: tasks
            };
        } else {
            // Don't create the node for the browser in case there is only one
            return buildTask.call(this, testType, test, browsers[0]);
        }
    }
};

var buildTasksArrays = function (testType, tests) {
    var res = [];
    for (var i = 0, l = tests.length; i < l; i++) {
        res[i] = buildTasksForTest.call(this, testType, tests[i]);
    }
    return res;
};

AllTests.prototype.init = function (callback) {
    var expectedCallbacks = 1;
    var testTypes = this.testTypes;
    var decrementExpectedCallbacks = function () {
        expectedCallbacks--;
        if (expectedCallbacks <= 0) {
            callback();
        }
    };
    var endFunction = function (testType) {
        var tasksTrees = buildTasksArrays.call(this, testType, testType.testsTrees);
        if (tasksTrees.length === 0) {
            this.logger.logWarn("There are no tasks defined for test type '%s'. Please check the configuration", [testType.name]);
        }
        // Only add a node for the test type if several types are defined:
        if (this.testTypesCount == 1) {
            this.tasksTrees = tasksTrees;
        } else {
            this.tasksTrees.push({
                name: testType.name,
                subTasks: tasksTrees
            });
        }
        if (testType.debug) {
            this.debugUrls.push({
                name: testType.name,
                url: url.normalize(testType.getBaseURL(true), testType.debug)
            });
        }
        decrementExpectedCallbacks();
    };
    for (var type in testTypes) {
        var testType = testTypes[type];
        expectedCallbacks++;
        testType.init(endFunction.bind(this, testType));
    }
    decrementExpectedCallbacks();
};

AllTests.prototype.dispose = function () {
    for (var type in this.testTypes) {
        var instance = this.testTypes[type];
        if (instance.dispose) {
            this.logger.logDebug("Disposing test type '%s'.", [type]);
            instance.dispose();
        }
    }
    this.logger.dispose();
};

module.exports = AllTests;
