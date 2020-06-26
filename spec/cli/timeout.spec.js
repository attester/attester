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

    it("after disconnect", function (done) {
        // this test starts attester with a first test which disconnects the browser
        // then it checks that attester is waiting for a browser to connect
        // instead of automatically making tasks timeout
        var phantomFinished = false;

        utils.runFromCommandLine({
            testCase: "timeout after disconnect",
            timeout: 20000,
            args: ['--max-task-restarts', '0', '--config.tests.mocha.files.includes', 'spec/test-type/mocha/extraScripts/disconnect.js', '--config.tests.mocha.files.includes', 'spec/test-type/mocha/sample-tests/**/*Test.js', '--task-timeout', '500']
        }, function (code, testExecution, errorMessages) {
            expect(phantomFinished).toEqual(true);
            expect(errorMessages.length).toEqual(1);
            expect(errorMessages[0]).toContain("Browser was disconnected");
            expect(testExecution).toEqual({
                run: 3,
                failures: 0,
                errors: 1,
                skipped: 0
            });
            done();
        });
        setTimeout(function () {
            utils.startPhantom([path.join(__dirname, '../../lib/browsers/phantomjs-control-script.js'), "--auto-exit", "--auto-exit-polling=2000", "http://localhost:7777/__attester__/slave.html"], function () {}, function (code) {
                phantomFinished = true;
            });
        }, 6000);
    }, 20000);
});
