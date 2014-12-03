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

function JsonReport() {
    this.flatReport = [];
    this.stats = {
        tasksIgnored: 0,
        tasksStarted: 0,
        tasksFinished: 0,
        tasksRestarts: 0,
        tasksSuccess: 0,
        tasksError: 0,
        testsStarted: 0,
        testsFinished: 0,
        testCases: 0,
        testMethods: 0,
        asserts: 0,
        failures: 0,
        errors: 0
    };
    this.report = {
        campaignId: null,
        stats: this.stats,
        tasks: this.treeReport
    };
    this.tasks = {};

    /**
     * keys are browser names, values: array of tuples [{ taskName, method, errorMessage }, ...]
     */
    this.tasksErrors = {};
    this.remainingTasks = 0;
}

function addToFlatReport(task) {
    var subTests = task.subTests;
/*if (task.errors) {
        // don't loose those errors
    }*/
    if (subTests) {
        var noGrandChildren = true,
            i, l = subTests.length;
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

function processTask(task) {
    var reportTask = {
        name: task.name,
        url: task.url
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

function processTasksList(tasks) {
    var res = [];
    for (var i = 0, l = tasks.length; i < l; i++) {
        res[i] = processTask.call(this, tasks[i]);
    }
    return res;
}

function getRunningTask(event) {
    var taskId = event.taskId;
    var task = this.tasks[taskId];
    if (!task || !task.events) {
        // TODO: error
        return;
    }
    return task;
}

var eventTypes = {
    tasksList: function tasksList(event) {
        this.report.tasks = processTasksList.call(this, event.tasks);
        this.report.campaignId = event.campaignId;
    },
    taskStarted: function taskStarted(event) {
        var taskId = event.taskId;
        var task = this.tasks[taskId];
        if (!task || task.startTime) {
            // TODO: error
            return;
        }
        task.nbAsserts = 0;
        task.nbFailures = 0;
        task.nbErrors = 0;
        task.startTime = event.time;
        task.events = [];
        this.stats.tasksStarted++;
    },
    taskFinished: function taskFinished(event) {
        var task = getRunningTask.call(this, event);
        if (!task) {
            return;
        }
        task.duration = event.time - task.startTime;
        var events = task.events;
        delete task.events;
        if (event.restartPlanned) {
            // undo what was done in taskStarted:
            delete task.startTime;
            this.stats.tasksStarted--;
            // counts the number of tasks restarts:
            this.stats.tasksRestarts++;
            return;
            // do not reset nbFailures or nbErrors to 0, the restart will do it
            // the values might be useful for console report
        }
        processTaskEvents.call(this, task, events);
        task.endTime = event.time;
        addToFlatReport.call(this, task);
        this.stats.tasksFinished++;
    },
    taskIgnored: function taskIgnored(event) {
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
    testStarted: queueTaskEvent,
    testFinished: function testFinished(event) {
        if (event.asserts) {
            // increase number of asserts so that console report can read and display it immediately
            // in case of task restart, the value will be reset to 0 in 'taskStarted'
            var task = getRunningTask.call(this, event);
            task.nbAsserts += event.asserts;
        }

        // enqueue for final processing (only processed when there are no restarts anymore)
        queueTaskEvent.call(this, event);
    },
    error: function error(event) {
        // mark failure/error on task so that console report can read and display it immediately;
        // in case of task restart, those values will be reset to 0 in 'taskStarted'
        var err = event.error;
        var task = getRunningTask.call(this, event);
        if (err.failure) {
            task.nbFailures++;
        } else {
            task.nbErrors++;
        }

        // enqueue for final processing (only processed when there are no restarts anymore)
        queueTaskEvent.call(this, event);
    }
};

var queuedEventTypes = {
    testStarted: function testStarted(task, event, runningTests) {
        var parent = task;
        var test = {
            name: event.name,
            startTime: event.time
        };
        var parentId = event.parentTestId;
        if (parentId) {
            parent = runningTests[parentId] || task;
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
        runningTests[event.testId] = test;
        this.stats.testsStarted++;
    },
    testFinished: function testFinished(task, event, runningTests) {
        var test = runningTests[event.testId];
        test.asserts = event.asserts;
        if (event.asserts) {
            this.stats.asserts += event.asserts;
        }
        test.endTime = event.time;
        test.duration = event.duration;
        this.stats.testsFinished++;
    },
    error: function error(task, event, runningTests) {
        var parent = task;
        if (event.testId) {
            parent = runningTests[event.testId] || task;
        }
        parent.errors = parent.errors || [];
        var err = event.error;
        parent.errors.push(err);

        var taskAndBrowserName = task.name.split(" on "); // "taskX on browserY"
        var browserName = taskAndBrowserName[1] || "default browser";
        this.tasksErrors[browserName] = this.tasksErrors[browserName] || [];
        this.tasksErrors[browserName].push({
            taskName: taskAndBrowserName[0],
            method: event.method || "",
            errorMessage: err.message
        });

        if (err.failure) {
            this.stats.failures++;
        } else {
            this.stats.errors++;
        }
    }
};

function queueTaskEvent(event) {
    var task = getRunningTask.call(this, event);
    if (!task) {
        return;
    }
    task.events.push(event);
}

function processTaskEvents(task, events) {
    var runningTests = {};
    var error = false;
    for (var i = 0, l = events.length; i < l; i++) {
        var curEvent = events[i];
        var eventName = curEvent.event;
        if (eventName == "error") {
            error = true;
        }
        queuedEventTypes[eventName].call(this, task, curEvent, runningTests);
    }
    if (error) {
        this.stats.tasksError++;
    } else {
        this.stats.tasksSuccess++;
    }
}

JsonReport.prototype = {};

JsonReport.prototype.addResult = function (event) {
    var eventName = event.event;
    var eventHandler = eventTypes[eventName];
    if (eventHandler) {
        eventHandler.call(this, event);
    }
};

module.exports = JsonReport;