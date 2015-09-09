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

var fs = require('fs');

var JsonLogReport = function (file) {
    this._stream = fs.createWriteStream(file);
    this._stream.write('[');
    this._first = true;
};

JsonLogReport.prototype = {};

JsonLogReport.prototype.addResult = function (event) {
    if (this._stream) {
        var value = JSON.stringify(event);
        if (this._first) {
            this._first = false;
        } else {
            this._stream.write(',\n');
        }
        this._stream.write(value);
        if (event.event == "campaignFinished") {
            this._stream.end(']');
            this._stream.destroySoon();
            this._stream = null;
        }
    }
};

module.exports = JsonLogReport;