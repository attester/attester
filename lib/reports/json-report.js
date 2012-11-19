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

/*
 * It is on purpose that this file does not have any external dependency,
 * so that it is easy to import this file in any other context (browser...)
 */

function JsonReport () {
    this.flatReport = [];
    this.stats = {
        tasksIgnored : 0,
        tasksStarted : 0,
        tasksFinished : 0,
        testsStarted : 0,
        testsFinished : 0,
        testCases : 0,
        testMethods : 0,
        asserts : 0,
        failures : 0,
        errors : 0
    };
    this.report = {
        campaignId : null,
        stats : this.stats,
        tasks : this.treeReport
    };
    this.tasks = {};
    this.remainingTasks = 0;
}

function addToFlatReport (task) {
    var subTests = task.subTests;
    /*if (task.errors) {
        // don't loose those errors
    }*/
    if (subTests) {
        var noGrandChildren = true, i, l = subTests.length;
        for (i = 0; i < l; i++) {
            var curSubTest = subTests[i];
            if (curSubTest.subTests) {
                noGrandChildren = false;
                break;
            }
        }
        if (noGrandChildren) {
            this.flatReport.push(task);
        } else {
            for (i = 0; i < l; i++) {
                addToFlatReport.call(this, subTests[i]);
            }
        }
    } else {
        this.flatReport.push(task);
    }
}

function processTask (task) {
    var reportTask = {
        name : task.name,
        url : task.url
    };
    this.tasks[task.taskId] = reportTask;
    var subTasks = task.subTasks;
    if (subTasks) {
        reportTask.subTasks = processTasksList.call(this, subTasks);
    } else {
        reportTask.subTests = [];
    }
    return reportTask;
}

function processTasksList (tasks) {
    var res = [];
    for (var i = 0, l = tasks.length; i < l; i++) {
        res[i] = processTask.call(this, tasks[i]);
    }
    return res;
}

function getRunningTask (event) {
    var taskId = event.taskId;
    var task = this.tasks[taskId];
    if (!task || !task.startTime || task.endTime) {
        // TODO: error
        return;
    }
    return task;
}

var eventTypes = {
    tasksList : function tasksList (event) {
        this.report.tasks = processTasksList.call(this, event.tasks);
        this.report.campaignId = event.campaignId;
    },
    taskStarted : function taskStarted (event) {
        var taskId = event.taskId;
        var task = this.tasks[taskId];
        if (!task || task.startTime) {
            // TODO: error
            return;
        }
        task.startTime = event.time;
        task.runningTests = {};
        this.stats.tasksStarted++;
    },
    taskFinished : function taskFinished (event) {
        var task = getRunningTask.call(this, event);
        if (!task) {
            return;
        }
        delete task.runningTests;
        task.endTime = event.time;
        task.duration = task.endTime - task.startTime;
        addToFlatReport.call(this, task);
        this.stats.tasksFinished++;
    },
    taskIgnored : function taskIgnored (event) {
        var taskId = event.taskId;
        var task = this.tasks[taskId];
        if (!task || task.startTime) {
            // TODO: error
            return;
        }
        task.startTime = event.time;
        task.endTime = event.time;
        task.duration = 0;
        task.ignored = true;
        delete task.subTests;
        addToFlatReport.call(this, task);
        this.stats.tasksIgnored++;
    },
    testStarted : function testStarted (event) {
        var task = getRunningTask.call(this, event);
        if (!task) {
            return;
        }
        var parent = task;
        var test = {
            name : event.name,
            startTime : event.time
        };
        var parentId = event.parentTestId;
        if (parentId) {
            parent = task.runningTests[parentId] || task;
        }
        if (event.method) {
            test.method = event.method;
            this.stats.testMethods++;
            if (!parent.subTests) {
                // count the parent as a test case
                this.stats.testCases++;
            }
        }
        if (!parent.subTests) {
            parent.subTests = [];
        }
        parent.subTests.push(test);
        task.runningTests[event.testId] = test;
        this.stats.testsStarted++;
    },
    testFinished : function testFinished (event) {
        var task = getRunningTask.call(this, event);
        if (!task) {
            return;
        }
        var test = task.runningTests[event.testId];
        test.asserts = event.asserts;
        if (event.asserts) {
            this.stats.asserts += event.asserts;
        }
        test.endTime = event.time;
        test.duration = test.endTime - test.startTime;
        this.stats.testsFinished++;
    },
    error : function error (event) {
        var task = getRunningTask.call(this, event);
        if (!task) {
            return;
        }
        var parent = task;
        if (event.testId) {
            parent = task.runningTests[event.testId] || task;
        }
        if (!parent.errors) {
            parent.errors = [];
        }
        var err = event.error;
        parent.errors.push(err);
        if (err.failure) {
            this.stats.failures++;
        } else {
            this.stats.errors++;
        }
    }
};

JsonReport.prototype = {};

JsonReport.prototype.addResult = function (event) {
    var eventName = event.event;
    var eventHandler = eventTypes[eventName];
    if (eventHandler) {
        eventHandler.call(this, event);
    }
};

module.exports = JsonReport;
