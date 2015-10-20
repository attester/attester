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

exports.normalize = function ( /* paths... */ ) {
    var path = [];

    for (var i = 0; i < arguments.length; i += 1) {
        var pathArray = arguments[i].split("/");
        pathArray.forEach(addToken, path);
    }
    return "/" + path.join("/");
};

// Should be called with scope = the array to be modified

function addToken(token) {
    if (".." === token) {
        this.pop();
    } else if ("." !== token && "" !== token) {
        this.push(token);
    }
}
