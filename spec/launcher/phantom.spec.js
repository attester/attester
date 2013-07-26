/*globals describe, it, runs, waitsFor, expect, beforeEach, afterEach */
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

var pathUtil = require("path");
var http = require("http");

var test_utils = require("../test-utils");

/**
 * Test the main script that drives phantom.
 * Its responsibilities are:
 * - open a URL
 * - communicate through callbacks (like sendEvent and screenshot)
 * - handle error messages
 * - auto-exit if the page is not loaded correctly
 */

function startPhantom(requestListener, callback, wait) {
    // If wait is specified, it calls the callback 'wait' ms after server.listening
    // Otherwise the callback is called on phantom.exit
    var server = http.createServer(requestListener).listen(0);
    server.on("listening", function () {
        var page = "http://localhost:" + server.address().port;
        var args = [pathUtil.join(__dirname, '../../lib/browsers/phantomjs.js'), "--auto-exit", "--auto-exit-polling=400", page];

        var messages = [];
        var onData = function (text) {
            messages.push(text);
        };
        var onExit = wait ?
        function () {} : function (code) {
            callback(code, messages);
        };
        var phantomProcess = test_utils.startPhantom(args, onData, onExit);
        if (wait) {
            setTimeout(function () {
                phantomProcess.kill();
                callback(0, messages);
            }, wait);
        }
    });
}

function hasMessage(needle, haystack) {
    for (var i = 0; i < haystack.length; i += 1) {
        if (haystack[i].indexOf(needle) !== -1) {
            return true;
        }
    }
    return false;
}

describe("Phantom control script", function () {
    it("loads a page in error", function (done) {
        var requestListener = function (request, response) {
            response.writeHead(505);
            response.end();
        };
        startPhantom(requestListener, function (code, messages) {
            expect(hasMessage("page open error with status: fail", messages)).toEqual(true);
            done();
        });
    });

    it("loads a page in without attester", function (done) {
        var requestListener = function (request, response) {
            response.writeHead(200);
            response.end("Whatever");
        };
        startPhantom(requestListener, function (code, messages) {
            expect(hasMessage("attester does not seem to be correctly loaded", messages)).toEqual(true);
            done();
        });
    });

    it("loads a page that never answers back", function (done) {
        var requestListener = function (request, response) {
            // Nothing
        };
        startPhantom(requestListener, function (code, messages) {
            expect(hasMessage("no reply from server after", messages)).toEqual(true);
            done();
        });
    });

    it("loads a page where attester does not connect", function (done) {
        var requestListener = function (request, response) {
            response.writeHead(200, {
                "Content-Type": "text/html"
            });
            response.end("<html><head><script>var attester={};</script></head><body></body></html>");
        };
        startPhantom(requestListener, function (code, messages) {
            expect(hasMessage("attester does not seem to be connected", messages)).toEqual(true);
            done();
        });
    });

    it("loads a page where attester is connected correctly", function (done) {
        var requestListener = function (request, response) {
            response.writeHead(200, {
                "Content-Type": "text/html"
            });
            response.end("<html><head><script>var attester={connected:true};</script></head><body></body></html>");
        };
        // Wait just a while to let other error raise
        startPhantom(requestListener, function (code, messages) {
            expect(hasMessage("opening URL", messages)).toEqual(true);
            expect(messages.length).toEqual(1);
            done();
        }, 2000);
    });

    it("reports an error", function (done) {
        var injectedCode = function () {
            window.attester = {
                connected: true,
                testError: function (errorObject) {
                    console.log(errorObject.error.message);
                }
            };
            setTimeout(function () {
                throw new Error("Induced exception");
            }, 50);
        };
        var requestListener = function (request, response) {
            response.writeHead(200, {
                "Content-Type": "text/html"
            });
            response.end("<html><head><script>(" + injectedCode.toString() + ")()</script></head><body></body></html>");
        };
        startPhantom(requestListener, function (code, messages) {
            expect(hasMessage("Induced exception (uncaught error received by PhantomJS)", messages)).toEqual(true);
            expect(messages.length).toEqual(2);
            done();
        }, 2000);
    });
});