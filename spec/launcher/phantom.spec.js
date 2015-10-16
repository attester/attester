/*global window */
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

var http = require("http");

var attester = require("../../lib/attester");
var phantomLauncher = require("../../lib/launchers/phantom-launcher");

var stdOutToMessages = function (stdout) {
    var result = stdout.trim().split("\n");
    return result.map(function (line) {
        return line.trim();
    });
};

/**
 * Test the main script that drives phantom.
 * Its responsibilities are:
 * - open a URL
 * - communicate through callbacks (like sendEvent and screenshot)
 * - handle error messages
 * - auto-exit if the page is not loaded correctly
 */

function startPhantom(requestListener, callback, wait, startCfg) {
    startCfg = startCfg || {};
    // If wait is specified, it calls the callback 'wait' ms after server.listening
    // Otherwise the callback is called on phantom.exit
    var server = http.createServer(requestListener).listen(0);
    server.on("listening", function () {
        var instanceId = Math.round(Math.random() * 1000) % 1000;
        var state = {
            retries: [],
            erroredPhantomInstances: 0
        };

        var stdout = ""; // stores stdout for later inspection in test cases
        var cfg = {
            maxRetries: startCfg.maxRetries || 0,
            phantomPath: "phantomjs",
            slaveURL: "http://localhost:" + server.address().port,
            pipeStdOut: false,
            phantomInstances: 1,
            args: {
                autoExitPolling: startCfg.autoExitPolling || 200
            },
            onData: function (data) {
                stdout += data.toString();
            },
            onAllPhantomsDied: startCfg.onAllPhantomsDied
        };
        cfg.onExit = wait ? (function () {}) : function (code) {
            if (cfg.maxRetries > 0) {
                // add the original onexit callback only if explicitly asked for
                var originalOnExit = phantomLauncher.createPhantomExitCb(cfg, state, instanceId).bind(phantomLauncher);
                originalOnExit(code);
            }
            callback(code, stdOutToMessages(stdout));
        };

        var phantomProcess = phantomLauncher.bootPhantom(cfg, state, instanceId);
        if (wait) {
            setTimeout(function () {
                phantomProcess.kill();
                callback(0, stdOutToMessages(stdout));
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
    beforeEach(function () {
        attester.config.set({
            colors: true
        });
    });

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
            expect(hasMessage("Timed out after waiting", messages)).toEqual(true);
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
            expect(messages.length).toEqual(3);
            done();
        }, 2000);
    });


    it("tries to reboot itself max. 3 times", function (done) {
        var requestListener = function (request, response) {
            response.writeHead(200, {
                "Content-Type": "text/html"
            });
            response.end("<html><head><script>var attester={connected:true};</script></head><body></body></html>");
        };

        // The idea is to set extremely low autoExitPolling => enforce timeout when loading.
        // When phantom fails to load on time, it should exit, respawn itself and try again.
        // This should happen exactly `phantomMaxRetries` times.
        // After that, `onAllPhantomsDied` callback should be called.
        console.log('\n---------------------------------------');
        console.log("PhantomJS auto-reboot test");
        console.log('---------------------------------------');
        console.log("Expecting PhantomJS exit errors and reboots when connecting to attester...");
        var phantomMaxRetries = 3;
        var timesPhantomExitCbCalled = 0;
        var onPhantomExit = function (code, messages) {
            expect(hasMessage("Timed out after waiting", messages)).toEqual(true);
            timesPhantomExitCbCalled++;
        };
        var onAllPhantomsDied = function () {
            // we want this to be run after the last call to onPhantomExit, hence nextTick
            process.nextTick(function () {
                expect(timesPhantomExitCbCalled).toEqual(phantomMaxRetries);
                done();
            });
        };
        startPhantom(requestListener, onPhantomExit, null, {
            autoExitPolling: 1,
            maxRetries: phantomMaxRetries,
            onAllPhantomsDied: onAllPhantomsDied
        });
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
            expect(messages.length).toEqual(4);
            done();
        }, 2000);
    });
});