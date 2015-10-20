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
 * This module is a simple publish / subscriber bus for events.
 * It allow to decouple modules that don't have to register listeners on other modules
 * but can simply listen to this module.
 *
 * The real good thing about this is that you can listen to all events
 */
var EventEmitter2 = require("eventemitter2").EventEmitter2;

var emitter = module.exports = new EventEmitter2({
    wildcard: true
});

/**
 * Forward an event with a different name but keeping the same arguments and context
 */
emitter.forward = function (newName) {
    return function () {
        var args = Array.prototype.slice.call(arguments);
        args.splice(0, 0, newName);
        emitter.emit.apply(emitter, args);
    };
};
