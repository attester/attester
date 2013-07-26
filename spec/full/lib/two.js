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

(function () {
    'use strict';
    var scope = this;

    var Constructor = function (value) {
        this.value = value;
    };
    Constructor.prototype.toNumber = function () {
        return scope.Numbers[this.value] || NaN;
    };
    Constructor.prototype.dontCallIt = function () {
        // This lines are intentionally useless, just to have a coverage !== 100
        var one = 1;
        var two = 2;
        return one + two === false;
    };
    scope.LibraryOne = new Constructor('one');
})();
