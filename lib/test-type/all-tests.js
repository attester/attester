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
var Logger = require('../logging/logger.js');

var testTypePrototypes = {
    'aria-templates': require('./aria-templates/at-test-type'),
    'mocha': require('./mocha/mocha-test-type')
};

var AllTests = function (campaign, config, parentLogger) {
    this.logger = new Logger('AllTests', parentLogger);
    this.campaign = campaign;
    this.config = config;
    var testTypes = {};
    var app = connect();

    var testTypesCount = 0;
    for (var type in config) {
        if (testTypePrototypes.hasOwnProperty(type)) {
            testTypesCount++;
            var curTestType = new testTypePrototypes[type](campaign, config[type]);
            testTypes[type] = curTestType;
            app.use(curTestType.handleRequest);
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
    if (browser != null) {
        browser.addTask(task);
        if (browser.name) {
            name += ' on ' + browser.name;
        }
    }
    return {
        taskId: taskId,
        name: name
    };
};

var buildTasksForTest = function (testType, test) {
    var subTests = test.subTests;
    var testResults = test.results;
    if (!subTests && !test.url && !testResults) {
        // something is wrong with this test!!
        testResults = [{
            event: "taskStarted"
        },
        {
            event: "error",
            name: test.name,
            error: {
                message: "This test does not have any url (this is probably an issue from the runner from " + testType.name + " test runner)."
            }
        },
        {
            event: "taskFinished"
        }];
    }
    if (testResults) {
        var res = buildTask.call(this, testType, test);
        var taskId = res.taskId;
        for (var i = 0, l = testResults.length; i < l; i++) {
            testResults[i].taskId = taskId;
            this.initResults.push(testResults[i]);
        }
        return res;
    }
    if (subTests) {
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
        // Only add a node for the test type if there several types are defined:
        if (this.testTypesCount == 1) {
            this.tasksTrees = tasksTrees;
        } else {
            this.tasksTrees.push({
                name: testType.name,
                subTasks: tasksTrees
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

module.exports = AllTests;