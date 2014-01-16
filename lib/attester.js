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

var Q = require("q");

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

/**
 * This is a convenience method to reset attester to its initial status. Resets all modules and re-initialize them
 * @return {Promise}
 */
attester.__reset__ = function () {
    var reInit = function () {
        for (var i = 0; i < allModules.length; i++) {
            var module = allModules[i];
            if (attester[module].__init__) {
                attester[module].__init__();
            }
        }
    };
    return attester.dispose().then(reInit);
};

/**
 * Dispose attester completely. This will make sure that every module and plugin is disposed correctly
 * before calling the callback. This action might be disruptive, so you'd better call passing process.exit
 * as callback. Attester might not work at all after calling this method
 * @return {Promise} gets resolved once all the modules are disposed
 */
attester.dispose = function () {
    attester.logger.logDebug("Disposing attester");

    // Call the reset of all modules. If the module has some work (sync or async) to cleanly dispose of itself, it MAY
    // implement __reset__ method which MUST return a Promise object. Once the module is done with disposing of itself,
    // it MUST resolve the promise. If module doesn't have __reset__ method, we assume it doesn't need any special
    // treatment.

    var pendingPromises = [];
    for (var j = allModules.length - 1; j >= 0; j--) {
        var module = allModules[j];

        if (attester[module].__reset__) {
            var promise = attester[module].__reset__();
            pendingPromises.push(promise);
        }
    }

    attester.logger.logDebug(pendingPromises.length + " promises to be fulfilled before disposing");
    return Q.all(pendingPromises).then(function () {
        attester.logger.logDebug("All promises fulfilled, dispose is over");
    }, function (reason) {
        attester.logger.logWarn("Error while resolving dispose promises: " + reason);
    });
};