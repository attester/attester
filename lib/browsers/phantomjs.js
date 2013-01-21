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

var parseCommandLine = function () {
    var args = system.args;
    for (var i = 0, l = args.length; i < l; i++) {
        if (args[i] == "--auto-exit") {
            autoExit = true;
        } else {
            url = args[i];
        }
    }
};

parseCommandLine();

var logHeader = "[PhantomJS " + id + "]";
console.log(logHeader + " opening URL " + url);

var page = require('webpage').create();

page.viewportSize = {width: 1016, height: 612};

page.onInitialized = function (arg1) {
    page.evaluate(function () {
        window.attesterConfig = {
            globalErrors: true,
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
                    args: [].slice.call(arguments,0)
                });
            }
        };
    });
    page.evaluate("function(){window.phantomJSRobot.keys=(" + JSON.stringify(page.event.key) + ");}");
};

var callbacks = {
    'attesterOnDisconnect' : function () {
        if (autoExit) {
            console.log(logHeader + " exiting");
            phantom.exit();
        }
    },
    'sendEvent' : function (event) {
        page.sendEvent.apply(page, event.args);
    }
};

page.onCallback = function (event) {
    var handler = callbacks[event.name];
    if (handler) {
        return handler(event);
    } else {
        console.log(logHeader + " the page is trying to call an undefined callback: ",event.name);
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
    page.evaluate("function(){window.top.attester.testError(" + JSON.stringify(errorObj) + ");}");
};

page.open(url);

if (autoExit) {
    var checkFunction = (function () {
        // For an unknown reason, page.evaluate does not always load the function in the top window,
        // but can sometimes load it in an iframe inside the page...
        var topWindow = window.top;
        if (!topWindow.attester) {
            topWindow.console.log('autoexit check error: attester does not seem to be correctly loaded!');
            topWindow.console.log("PHANTOMJS-ATTESTER-DISCONNECT");
        } else if (!topWindow.attester.connected) {
            topWindow.console.log('autoexit check error: attester does not seem to be connected!');
            topWindow.console.log("PHANTOMJS-ATTESTER-DISCONNECT");
        }
    }).toString();
    setInterval(function () {
        page.evaluate(checkFunction);
    }, 5000);
}