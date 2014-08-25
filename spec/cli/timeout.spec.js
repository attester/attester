/*globals describe, it, runs, waitsFor, expect*/
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

var path = require("path");
var utils = require("../test-utils");

describe('timeout', function () {

    it("after disconnect", function () {
        // this test starts attester with a first test which disconnects the browser
        // then it checks that attester is waiting for a browser to connect
        // instead of automatically making tasks timeout
        var attesterFinished = false;
        var phantomFinished = false;
        var okToContinue = false;
        runs(function () {
            utils.runFromCommandLine({
                testCase: "timeout after disconnect",
                timeout: 10000,
                args: ['--max-task-restarts', '0', '--config.tests.mocha.files.includes', 'spec/test-type/mocha/extraScripts/disconnect.js', '--config.tests.mocha.files.includes', 'spec/test-type/mocha/sample-tests/**/*Test.js', '--task-timeout', '500']
            }, function (code, testExecution, errorMessages) {
                attesterFinished = true;
                expect(errorMessages.length).toEqual(1);
                expect(errorMessages[0]).toContain("Browser was disconnected");
                expect(testExecution).toEqual({
                    run: 3,
                    failures: 0,
                    errors: 1,
                    skipped: 0
                });
            });
            setTimeout(function () {
                okToContinue = true;
            }, 6000);
        });
        waitsFor(function () {
            return attesterFinished || okToContinue;
        }, 7000, 'some time');
        runs(function () {
            utils.startPhantom([path.join(__dirname, '../../lib/browsers/phantomjs-control-script.js'), "--auto-exit", "--auto-exit-polling=2000", "http://localhost:7777/__attester__/slave.html"], function () {}, function (code) {
                phantomFinished = true;
            });
        });
        waitsFor(function () {
            return attesterFinished && phantomFinished;
        }, 3000, 'attester and phantom to complete');
        runs(function () {
            expect(attesterFinished).toEqual(true);
            expect(phantomFinished).toEqual(true);
        });
    });
});