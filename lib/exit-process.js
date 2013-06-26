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

var waitForStreamEnd = function (stream, callback) {
    // writes an empty string to check the state of the buffer
    if (!stream.write("")) {
        stream.once('drain', callback);
    } else {
        callback();
    }
};

module.exports = function (exitCode) {
    var ok = 0;
    var increaseOk = function () {
        ok++;
        if (ok == 3) {
            process.exit(exitCode);
        }
    };
    waitForStreamEnd(process.stdout, increaseOk);
    waitForStreamEnd(process.stderr, increaseOk);
    process.nextTick(increaseOk); // make sure it is always asynchronous
};
