/* globals attester, mocha */
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
    var testName = decodeURIComponent(window.location.search.match(/\bname=(.+)(&.+)?$/)[1]);
    var idCounter = 0;

    var baseReporter = mocha._reporter;
    mocha.reporter(function (runner) {
        if (!runner || !baseReporter) {
            return attester.testError({
                error: {
                    message: "Mocha runner not available"
                }
            });
        }

        baseReporter.call(this, runner);

        /**
         * Mocha emits the following events
         *
         * - start : When the root test suite start
         * - suite : When a suite start (suite === describe)
         * - suite end : When a suite ends
         * - hook : When an hook starts (before, beforeEach, after, afterEach)
         * - hook end : When an hook ends (as it might be asynchronous)
         * - test : When a test starts (test === it)
         * - pass : When a test passes
         * - fail : When a test fails
         * - test end : When a test ends, either after a pass or a fail
         * - end : When all tests and suites end
         * - pending : When a test is skipped
         *
         * For reference have a look here https://github.com/visionmedia/mocha/blob/master/lib/runner.js
         *
         * We are only interested in few of them
         */

        runner.on("suite", function (suite) {
            idCounter += 1;
            suite._attester_id = idCounter;
            if (suite.root) {
                attester.testStart({
                    name: testName,
                    testId: idCounter
                });
            } else {
                attester.testStart({
                    name: testName + " " + suite.title,
                    testId: idCounter,
                    parentTestId: suite.parent._attester_id
                });
            }
        });

        runner.on("suite end", function (suite) {
            if (suite.root) {
                attester.testEnd({
                    name: testName,
                    testId: suite._attester_id
                });
            } else {
                attester.testEnd({
                    name: testName + " " + suite.title,
                    testId: suite._attester_id,
                    parentTestId: suite.parent._attester_id
                });
            }
        });

        runner.on("test", function (test) {
            idCounter += 1;
            test._attester_id = idCounter;
            attester.testStart({
                name: testName + " " + test.title,
                testId: idCounter,
                parentTestId: test.parent._attester_id,
                method: test.title
            });
        });

        runner.on("test end", function (test) {
            attester.testEnd({
                name: testName + " " + test.title,
                testId: test._attester_id,
                parentTestId: test.parent._attester_id,
                method: test.title
            });
        });

        var runningHook = null;
        runner.on("hook", function (hook) {
            // Hooks might fail as well as other tests
            idCounter += 1;
            hook._attester_id = idCounter;
            runningHook = {
                name: testName + " " + hook.title,
                testId: idCounter,
                parentTestId: hook.parent._attester_id
            };
            attester.testStart(runningHook);
        });

        runner.on("hook end", function (hook) {
            runningHook = null;
            attester.testEnd({
                name: testName + " " + hook.title,
                testId: hook._attester_id,
                parentTestId: hook.parent._attester_id
            });
        });

        runner.on("fail", function (test, err) {
            attester.testError({
                name: testName + " " + test.title,
                error: {
                    message: err.message,
                    stack: attester.stackTrace(err)
                }
            });
        });

        runner.on("end", function () {
            if (runningHook !== null) {
                // Due to https://github.com/visionmedia/mocha/pull/664
                // hook end is not called when the hook fails, for this reason
                // we keep track of the running hook and if any we notify its end
                attester.testEnd(runningHook);
            }
            attester.coverage(window);
            attester.taskFinished();
        });
    });
})();
