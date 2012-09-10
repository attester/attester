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

console.log("[PhantomJS] opening URL " + url);

var page = require('webpage').create();
page.onInitialized = function (arg1) {
    page.evaluate(function () {
        window.attesterConfig = {
            globalErrors : true,
            onDisconnect : function () {
                console.log("PHANTOMJS-ATTESTER-DISCONNECT");
            }
        };
    });
};

page.onConsoleMessage = function (msg) {
    if (msg == "PHANTOMJS-ATTESTER-DISCONNECT") {
        if (autoExit) {
            console.log("[PhantomJS] exiting");
            phantom.exit();
        }
    } else {
        console.log("[PhantomJS] log: ", msg);
    }
};

page.onError = function (error, stack) {
    var error = {
        error : {
            message : error + " (uncaught error received by PhantomJS)",
            stack : stack
        }
    };
    page.evaluate("function(){window.attester.testError(" + JSON.stringify(error) + ");}");
};

page.open(url);

if (autoExit) {
    var checkFunction = (function () {
        if (!window.attester || !window.attester.connected) {
            console.log("PHANTOMJS-ATTESTER-DISCONNECT");
        }
    }).toString();
    setInterval(function () {
        page.evaluate(checkFunction);
    }, 5000);
}
