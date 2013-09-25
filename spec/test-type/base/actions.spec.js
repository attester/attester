/* globals attester, expect, describe, it, beforeEach, afterEach */
/*
 * Copyright 2013 Amadeus s.a.s.
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

var util = require("util");
var pathUtil = require("path");

var test_utils = require("../../test-utils");
var BaseTestType = require("../../../lib/test-type/base-test-type");
var staticFile = require('../../../lib/middlewares/staticFile');

// The tests here create a global variable that is then logged during attester.currentTask.start
// The assertion verifies the content of this variable after all actions
describe("start actions", function () {
    it("loads without actions", function (done) {
        var testType = createType({
            tagName: "script",
            content: "window._test_content = 'init done'"
        });
        var initDone = false;
        test_utils.createServer(testType, "/", function (baseUrl, closeCallback) {
            var args = [pathUtil.join(__dirname, "phantomjs.js"), "--exit-when", "phantom_exit", baseUrl + "__attester__/test.html"];
            test_utils.startPhantom(args, function (text) {
                if (text.indexOf("TEST CONTENT: init done") !== -1) {
                    initDone = true;
                }
            }, function () {
                expect(initDone).toEqual(true);
                closeCallback(done);
            });
        });
    });

    it("loads with a sync action", function (done) {
        var testType = createType([{
            tagName: "script",
            content: "window._test_content = 'one'"
        },
        {
            tagName: "script",
            content: "attester.currentTask.actions.push(function () {window._test_content = 'two';});"
        }]);
        var initDone = false;
        test_utils.createServer(testType, "/", function (baseUrl, closeCallback) {
            var args = [pathUtil.join(__dirname, "phantomjs.js"), "--exit-when", "phantom_exit", baseUrl + "__attester__/test.html"];
            test_utils.startPhantom(args, function (text) {
                if (text.indexOf("TEST CONTENT: two") !== -1) {
                    initDone = true;
                }
            }, function () {
                expect(initDone).toEqual(true);
                closeCallback(done);
            });
        });
    });

    it("loads with multiple action", function (done) {
        var testType = createType([{
            tagName: "script",
            content: "window._test_content = 'one'"
        },
        {
            tagName: "script",
            content: "attester.currentTask.actions.push(function () {window._test_content += '_two';});"
        },
        {
            tagName: "script",
            content: inline(function () {
                // This action is really asynchronous
                attester.currentTask.actions.push(function (back) {
                    window._test_content += '_three';
                    setTimeout(function () {
                        window._test_content += '_four';
                        back();
                    }, 50);
                });
            })
        },
        {
            tagName: "script",
            content: inline(function () {
                // This action is declared sync, but does stuff anyway
                attester.currentTask.actions.push(function () {
                    window._test_content += '_five';
                    setTimeout(function () {
                        window._test_content += '_six';
                    }, 50);
                });
            })
        },
        {
            tagName: "script",
            content: inline(function () {
                // This action should be execute before the previous callback
                attester.currentTask.actions.push(function (back) {
                    window._test_content += '_seven';
                    setTimeout(function () {
                        window._test_content += '_eight';
                        back();
                    }, 60);
                });
            })
        }]);
        var initDone = false;
        test_utils.createServer(testType, "/", function (baseUrl, closeCallback) {
            var args = [pathUtil.join(__dirname, "phantomjs.js"), "--exit-when", "phantom_exit", baseUrl + "__attester__/test.html"];
            test_utils.startPhantom(args, function (text) {
                if (text.indexOf("TEST CONTENT: one_two_three_four_five_seven_six_eight") !== -1) {
                    initDone = true;
                }
            }, function () {
                expect(initDone).toEqual(true);
                closeCallback(done);
            });
        });
    });
});

function createType(headContent) {
    var Type = function () {
        // This time use some configuration
        BaseTestType.call(this, {
            baseURL: "/"
        }, {});

        // The base test logs the content of a test variable, we can then assert on it
        this.baseTestContent = {
            head: [],
            body: [{
                tagName: "script",
                content: inline(function () {
                    attester.currentTask.start = function () {
                        console.log("TEST CONTENT:", window._test_content);
                        var stop = document.createElement("div");
                        stop.id = "phantom_exit";
                        document.body.appendChild(stop);
                    };
                })
            }]
        };

        this.testPage("test.html", {
            head: headContent
        });

        this.use(staticFile.bind({
            page: "iframe.js",
            path: pathUtil.join(__dirname, "../../../lib/test-server/client/iframe.js")
        }));
    };
    util.inherits(Type, BaseTestType);
    Type.prototype.name = "start";
    Type.prototype.type = "";

    var testType = new Type();

    return testType;
}

function inline(method) {
    return "(" + method.toString() + ")();";
}