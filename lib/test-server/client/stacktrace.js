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

(function () {
    var window = this;

    var emptySpaceStart = /^\s*/;
    var emptySpaceEnd = /\s*$/;

    var startsWithAt = /^\s*at\s+/;
    var phantomJsStackWithFunctionName = /^\s*at\s+([^(]+)\((.*):([0-9]+)\)$/;
    var phantomJsStackWithoutFunctionName = /^\s*at\s+(.*):([0-9]+)$/;
    var firefoxStack = /^([^@]*)@(.*):([0-9]+)$/;

    var processLine = function (line) {
        var match = phantomJsStackWithFunctionName.exec(line);
        if (match) {
            return {
                'function': match[1],
                'file': match[2],
                'line': match[3]
            };
        }
        match = phantomJsStackWithoutFunctionName.exec(line);
        if (match) {
            return {
                'function': '',
                'file': match[1],
                'line': match[2]
            };
        }
        match = firefoxStack.exec(line);
        if (match) {
            return {
                'function': match[1],
                'file': match[2],
                'line': match[3]
            };
        }
        return {
            'function': line
        };
    };

    window.attester.stackTrace = function (exception) {
        var skipFirstLine = false;
        if (!exception || !exception.stack) {
            try {
                var zero = 0;
                zero(); // raise an exception on purpose to have the stack trace
            } catch (e) {
                exception = e;
                skipFirstLine = true;
            }
        }
        var res = [];
        var stack = exception.stack;
        if (stack) {
            // remove extra space at the end and begining of the stack:
            stack = stack.replace(emptySpaceStart, '').replace(emptySpaceEnd, '');
            res = stack.split('\n');
            if (res.length >= 2 && startsWithAt.test(res[1]) && !startsWithAt.test(res[0])) {
                // PhantomJS (and perhaps other browsers) include the error message in the stack trace
                // we remove it here:
                res.splice(0, 1);
            }
            if (skipFirstLine) {
                res.splice(0, 1);
            }
            for (var i = 0, l = res.length; i < l; i++) {
                res[i] = processLine(res[i]);
            }
        }
        return res;
    };

})();