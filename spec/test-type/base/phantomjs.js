/* globals phantom */
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

/**
 * This script opens a page and waits for an element to be available, it is launched like this
 * --exit-when test_id [page_url]
 * It'll wait for a maximum of 2 seconds for an element with id test_id to be in the page and then close
 */

var system = require("system");
var page = require("webpage").create();

var url = system.args[system.args.length - 1];
var endCondition = "";
for (var i = 0; i < system.args.length; i += 1) {
    var arg = system.args[i];
    if (arg === "--exit-when") {
        endCondition = system.args[i + 1];
        i += 1;
    }
}

page.onCallback = function(found) {
    if (!found) {
        console.log("ERROR element with id '" + endCondition + "' was not found in the page");
    }
    phantom.exit();
};

page.onConsoleMessage = function(msg, lineNum, sourceId) {
    console.log("CONSOLE: " + msg);
};

page.open(url, function (status) {
    if (status !== "success") {
        console.log("ERROR page open error with status:", status);
        phantom.exit(1);
    } else {
        page.evaluate(function (id) {
            var start_polling = new Date();
            var interval = setInterval(function () {
                var element_found = !!document.getElementById(id);
                if (element_found || (new Date() - start_polling) > 2000) {
                    clearInterval(interval);
                    window.callPhantom(element_found);
                }
            }, 100);
        }, endCondition);
    }
});
