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
 * Main attester module.
 * This is used by the command line or other node modules to create and control campaigns.
 *
 * This module simply exposes the interface of attester
 *
 * It groups several other modules like
 * - config to read configuration files
 * - server to create a test server
 * - campaign to create a campaign
 * - core where all other modules are connected
 *
 * Core modules might implement the following methods
 * - __init__ this is called after all module have been required, it allows to perform actions
 *   after all modules are available. It is advisable to add event listeners in this method
 * - __reset__ this is never called by attester itself, but it's still available to be called
 *   by tests. This method should reset the module to its initial state before the __init__
 */

var util = require("util");
var events = require("events");

var AttesterConstructor = function () {
    events.EventEmitter.call(this);
};

util.inherits(AttesterConstructor, events.EventEmitter);

var attester = module.exports = new AttesterConstructor();

function exposeModules() {
    // First require all modules
    var name;
    for (var i = 0; i < arguments.length; i += 1) {
        name = arguments[i];
        attester[name] = require("./attester/" + name);
    }
    // Once all of them are required, initialize them, this allows some dependencies to be met
    for (i = 0; i < arguments.length; i += 1) {
        name = arguments[i];
        if ("__init__" in attester[name]) {
            attester[name].__init__();
        }
    }
}

// Provide a shortcut for some methods on a given module

function shortCut(module, method, shortcut) {
    // keep the same name if a better one was not passed
    shortcut = shortcut || method;

    attester[shortcut] = attester[module][method].bind(attester[module]);
}

// Modules are required following the order, but they should loosely depend on each other
var allModules = ["event", "logger", "config", "reports", "middlewares", "server", "campaign", "launcher", "core", "testPage", "plugins"];
exposeModules.apply(this, allModules);

// attester.package will be our package.json
Object.defineProperty(attester, "package", {
    value: require("../package.json"),
    writable: false
});

shortCut("core", "start");

// This is a convenience method to reset attester to its initial status
// Resets all modules and re-initialize them
attester.__reset__ = function (callback) {
    attester.dispose(function () {
        for (var i = 0; i < allModules.length; i += 1) {
            var module = allModules[i];
            if (attester[module].__init__) {
                attester[module].__init__();
            }
        }
        callback();
    });
};

/**
 * Dispose attester completely. This will make sure that every module and plugin is disposed correctly
 * before calling the callback. This action might be disruptive, so you'd better call passing process.exit
 * as callback. Attester might not work at all after calling this method
 */
attester.dispose = function (callback) {
    attester.logger.logDebug("Disposing attester");
    // Call the reset of all modules, if they are busy doing things they should raise the event
    //  attester.please.hold
    // This will prevent attester from calling the callback
    // When the module is disposed correctly it should call
    //  attester.please.continue
    // There are two critical actions that can be blocking
    // - event attester.closing
    // - module reset
    chain(function () {
        attester.event.emit("attester.closing");
    }, function () {
        for (var i = 0; i < allModules.length; i += 1) {
            var module = allModules[i];
            if (attester[module].__reset__) {
                attester[module].__reset__();
            }
        }
    }, callback);
};

function chain( /* callbacks */ ) {
    var methods = [].slice.call(arguments);

    var pending = 0;
    var next = function () {
        if (methods.length) {
            var action = methods.shift();
            process.nextTick(function () {
                action();
                if (pending === 0) {
                    next();
                }
                // else wait for the event to call the next action
            });
        } else {
            attester.event.removeAllListeners("attester.please.*");
        }
    };

    attester.event.on("attester.please.*", function () {
        if (this.event === "attester.please.hold") {
            pending += 1;
        } else {
            pending -= 1;
            next();
        }
    });
    next();
}