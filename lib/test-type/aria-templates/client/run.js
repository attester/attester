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

(function () {
    var window = this;
    var attester = window.parent.attester;
    var Aria = window.Aria;

    if (!attester) {
        // For debug purposes:
        attester = {
            testStart: function (info) {
                console.log('testStart', info);
            },
            testEnd: function (info) {
                console.log('testEnd', info);
            },
            testError: function (info) {
                console.log('testError', info);
            },
            taskFinished: function (info) {
                console.log('taskFinished', info);
            },
            stackTrace: function () {
                return [];
            }
        };
    }

    var fatalError = function (message) {
        attester.testError({
            error: {
                message: message
            }
        });
        attester.taskFinished();
    };

    if (!Aria || !Aria.load) {
        fatalError("The Aria Templates framework could not be loaded.");
        return;
    }

    var testClasspath = window.__testClasspath;
    var mainTestObject = null;
    var testsCount = 0;
    var runningTests = 0;
    var registeredTests = [];

    window.onerror = function (message, file, line) {
        attester.testError({
            error: {
                message: message,
                stack: [{
                    file: file,
                    line: line
                }]
            }
        });
    };

    function findTest(testObject) {
        for (var i = 0, l = registeredTests.length; i < l; i++) {
            if (registeredTests[i].testObject == testObject) {
                return registeredTests[i];
            }
        }
        return {};
    }

    function registerTest(testObject) {
        testsCount++;
        var testId = testsCount;
        var testInfo = {
            testId: testId,
            testClass: testObject.$classpath,
            testObject: testObject
        };
        registeredTests.push(testInfo);
        testObject.$on({
            testLoad: onTestLoad,
            start: onTestStart,
            end: onTestEnd,
            stateChange: onTestStateChange,
            error: onTestError,
            failure: onTestFailure,
            scope: this
        });
        return testInfo;
    }

    function unregisterTest(testObject) {
        testObject.$removeListeners({
            testLoad: onTestLoad,
            start: onTestStart,
            end: onTestEnd,
            stateChange: onTestStateChange,
            error: onTestError,
            failure: onTestFailure,
            scope: this
        });
        for (var i = 0, l = registeredTests.length; i < l; i++) {
            if (registeredTests[i].testObject === testObject) {
                registeredTests.splice(i, 1);
                break;
            }
        }
    }

    function onTestLoad(evt) {
        var testInfo = registerTest(evt.testObject);
        var parentTest = findTest(evt.testLoader);
        testInfo.parentTestId = parentTest.testId;
    }

    function onTestStart(evt) {
        runningTests++;
        var testInfo = findTest(evt.testObject);
        attester.testStart({
            name: evt.testClass,
            testId: testInfo.testId,
            parentTestId: testInfo.parentTestId
        });
    }

    function onTestFailure(evt) {
        var testInfo = findTest(evt.src);
        updateTestState(evt.testState, testInfo);
        attester.testError({
            testId: testInfo.testStateId || testInfo.testId,
            name: testInfo.testClass,
            method: testInfo.testState,
            error: {
                failure: true,
                message: evt.description,
                stack: attester.stackTrace()
            }
        });
    }

    function onTestError(evt) {
        var testInfo = findTest(evt.src);
        updateTestState(evt.testState, testInfo);
        attester.testError({
            testId: testInfo.testStateId || testInfo.testId,
            name: testInfo.testClass,
            method: testInfo.testState,
            error: {
                message: evt.msg,
                stack: attester.stackTrace(evt.exception)
            }
        });
    }

    function updateTestState(newTestState, testInfo) {
        // states are reported as sub-tests
        var currentTestState = testInfo.testState;
        if (currentTestState != newTestState) {
            if (currentTestState) {
                attester.testEnd({
                    testId: testInfo.testStateId,
                    name: testInfo.testClass,
                    method: currentTestState
                });
                testInfo.testState = null;
                testInfo.testStateId = null;
            }
            if (newTestState) {
                testsCount++;
                testInfo.testState = newTestState;
                testInfo.testStateId = testsCount;
                attester.testStart({
                    name: testInfo.testClass,
                    method: newTestState,
                    testId: testsCount,
                    parentTestId: testInfo.testId
                });
            }
        }
    }

    function onTestStateChange(evt) {
        var testState = evt.testState;
        if (testState) {
            var testInfo = findTest(evt.src);
            updateTestState(testState, testInfo);
        }
    }

    function cleanTaskEnd() {
        try {
            mainTestObject.$dispose();
            mainTestObject = null;
        } catch (e) {
            attester.testError({
                error: {
                    message: "Error while disposing test " + testClasspath,
                    stack: attester.stackTrace(e)
                }
            });
        }
        if (Aria.memCheckMode) {
            try {
                var disposeInfos = Aria.dispose();
                if (disposeInfos && disposeInfos.nbNotDisposed > 0) {
                    var undisposed = disposeInfos.notDisposed;
                    var msg = [];
                    var previous = false;
                    for (var i in undisposed) {
                        if (undisposed.hasOwnProperty(i)) {
                            if (!previous) {
                                previous = true;
                            } else {
                                msg.push('\n');
                            }
                            var obj = undisposed[i];
                            msg.push(obj.$classpath);
                            var createdFromTest = obj['aria:createdFromTest'];
                            if (createdFromTest) {
                                msg.push(' (probably created in ', createdFromTest, ')');
                            }
                        }
                    }
                    attester.testError({
                        error: {
                            message: 'The following ' + disposeInfos.nbNotDisposed + ' objects were not disposed correctly:\n' + msg.join('')
                        }
                    });
                }
            } catch (e) {
                attester.testError({
                    error: {
                        message: "Error while disposing Aria Templates: " + e,
                        stack: attester.stackTrace(e)
                    }
                });
            }
        }
        attester.coverage(window);
        attester.taskFinished();
    }

    function onTestEnd(evt) {
        var testInfo = findTest(evt.testObject);
        updateTestState(null, testInfo);
        unregisterTest(evt.testObject);
        runningTests--;
        attester.testEnd({
            testId: testInfo.testId,
            name: testInfo.testClass,
            asserts: evt.nbrOfAsserts
        });
        if (runningTests === 0) {
            window.setTimeout(cleanTaskEnd, 0);
        }
    }

    function startTest() {
        try {
            mainTestObject = Aria.getClassInstance(testClasspath);
        } catch (e) {
            fatalError("An exception was thrown while trying to instantiate " + testClasspath + ": " + e);
        }
        registerTest(mainTestObject);
        mainTestObject.run();
    }

    Aria.load({
        classes: [testClasspath, 'aria.utils.String'],
        oncomplete: startTest,
        onerror: function () {
            fatalError("The '" + testClasspath + "' test could not be loaded.");
        }
    });
})();
