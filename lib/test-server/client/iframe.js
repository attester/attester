/* global document */
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

/**
 * This script is included in the test page inside the iframe.
 * It provides base functionalities when
 * - interactive page, where the browser is not connected as slave
 * - start testing
 * - include a test in the page
 */
(function () {
    var window = this;
    var attester = this.attester = window.parent.attester;

    if (!attester) {
        // For debug purposes all slave actions are redirected to console log
        attester = this.attester = {
            testStart: function (info) {
                console.log('testStart', info);
            },
            testEnd: function (info) {
                console.log('testEnd', info);
            },
            testError: function (info) {
                console.log('testError', info);
            },
            taskFinished: function (info) {
                console.log('taskFinished', info);
            },
            stackTrace: function () {
                return [];
            },
            coverage: function () {},
            installConsole: function () {},
            currentTask: {}
        };
    }

    attester.installConsole(window);

    // This should be implemented by test-types
    attester.currentTask.start = function () {};
    // Actions can be added by plugins and should be performed before the start
    attester.currentTask.actions = [];

    // By default we simply include a script in the page when we try to load a test
    if (!attester.currentTask.includeTests) {
        // It could be overridden by plugins and other script loaders
        attester.currentTask.includeTests = function (scripts, callback) {
            var info = {
                pending: scripts.length,
                callback: callback
            };

            for (var i = 0; i < scripts.length; i += 1) {
                loadScript(scripts[i], scriptLoaded(info));
            }
        };
        var loadScript = function (path, callback) {
            var script, head = document.head || document.getElementsByTagName("head")[0] || document.documentElement;
            script = document.createElement("script");
            script.async = true;
            script.src = path;
            script.onload = script.onreadystatechange = function () {
                if ((script.readyState && script.readyState != "complete" && script.readyState != "loaded")) {
                    return;
                }
                // Handle memory leak in IE
                script.onload = script.onreadystatechange = null;
                script = undefined;
                head = undefined;
                callback();
            };
            // Circumvent IE6 bugs with base elements (jQuery #2709 and #4378) by prepending
            head.insertBefore(script, head.firstChild);
        };
        var scriptLoaded = function (bind) {
            return function () {
                bind.pending -= 1;
                if (bind.pending === 0) {
                    bind.callback();
                }
            };
        };
    }

    // Plugins might inject action to be called before running the tests, execute them
    attester.currentTask.__init__ = function () {
        if (attester.currentTask.actions.length === 0) {
            attester.currentTask.start();
        } else {
            var action = attester.currentTask.actions.shift();
            if (action.length > 0) {
                // Being action a function it means it accepts a callback, so it's asynchronous
                action(attester.currentTask.__init__);
            } else {
                action();
                attester.currentTask.__init__();
            }
        }
    };
    // attester.currentTask.__init__ is called by the last script in the page
    // this gives plugins the time to add actions
})();
