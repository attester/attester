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

var system = require('system');

var url;
var autoExit = false;
// Id for this instance of PhantomJS
var id = new Date().getTime() % 100;
// When auto-exit is enabled, check for errors every x milliseconds
var autoexitPolling = 5000;

var parseCommandLine = function () {
    var args = system.args;
    for (var i = 0, l = args.length; i < l; i++) {
        if (args[i] == "--auto-exit") {
            autoExit = true;
        } else if (args[i].indexOf("--auto-exit-polling") === 0) {
            autoexitPolling = parseInt(args[i].split("=")[1], 10) || autoexitPolling;
        } else {
            url = args[i];
        }
    }
};

parseCommandLine();

var logHeader = "[PhantomJS " + id + "]";
console.log(logHeader + " opening URL " + url);

var page = require('webpage').create();

page.viewportSize = {
    width: 1016,
    height: 612
};

page.onInitialized = function (arg1) {
    page.evaluate(function () {
        window.attesterConfig = {
            onDisconnect: function () {
                window.callPhantom({
                    name: 'attesterOnDisconnect'
                });
            }
        };
        window.phantomJSRobot = {
            sendEvent: function () {
                window.callPhantom({
                    name: 'sendEvent',
                    args: [].slice.call(arguments, 0)
                });
            },
            screenshot: function (file) {
                window.callPhantom({
                    name: "screenshot",
                    file: file
                });
            }
        };
    });
    page.evaluate("function(){window.phantomJSRobot.keys=(" + JSON.stringify(page.event.key) + ");}");
};

var callbacks = {
    'attesterOnDisconnect': function () {
        if (autoExit) {
            console.log(logHeader, "exiting");
            console.log("Page content of URL", page.url, "\n", page.content);
            phantom.exit();
        }
    },
    'sendEvent': function (event) {
        page.sendEvent.apply(page, event.args);
    },
    'screenshot': function (event) {
        page.render(event.file);
    }
};

page.onCallback = function (event) {
    var handler = callbacks[event.name];
    if (handler) {
        return handler(event);
    } else {
        console.log(logHeader + " the page is trying to call an undefined callback: ", event.name);
    }
};

page.onConsoleMessage = function (msg) {
    console.log(logHeader + " log: ", msg);
};

page.onError = function (error, stack) {
    var errorObj = {
        error: {
            message: error + " (uncaught error received by PhantomJS)",
            stack: stack
        }
    };
    var code = (function () {
        var iframe = window.top.document.getElementById("iframe");
        if (!iframe || !iframe.contentWindow || !iframe.contentWindow.onerror) {
            // The error is not handled by the test type
            window.top.attester.testError(__ERROR_OBJECT__);
        }
    }).toString().replace(/__ERROR_OBJECT__/g, JSON.stringify(errorObj));
    page.evaluate(code);
};

/**
 * Checks for errors in the opened page every 'autoexitPolling' milliseconds, this value can be controlled
 * by the command line parameter --auto-exit-polling=x
 */

function startPollingForErrors() {
    if (autoExit) {
        var checkFunction = (function () {
            // For an unknown reason, page.evaluate does not always load the function in the top window,
            // but can sometimes load it in an iframe inside the page...
            var topWindow = window.top;
            if (!topWindow.attester) {
                topWindow.console.log("autoexit check error: attester does not seem to be correctly loaded!");
                topWindow.callPhantom({
                    name: "attesterOnDisconnect"
                });
            } else if (!topWindow.attester.connected) {
                topWindow.console.log("autoexit check error: attester does not seem to be connected!");
                topWindow.callPhantom({
                    name: "attesterOnDisconnect"
                });
            }
        }).toString();
        setInterval(function () {
            page.evaluate(checkFunction);
        }, autoexitPolling);
    }
}

var pageOpenTimeout = setTimeout(function () {
    console.log(logHeader, "no reply from server after", 2 * autoexitPolling, "milliseconds");
    callbacks["attesterOnDisconnect"]();
}, 2 * autoexitPolling);

page.open(url, function (status) {
    clearTimeout(pageOpenTimeout);
    if (status !== "success") {
        console.log(logHeader, "page open error with status:", status);
        callbacks["attesterOnDisconnect"]();
    } else {
        startPollingForErrors();
    }
});