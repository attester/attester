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

var processFile = function processFile(out, fileName, fileInfos) {
    fileName = fileName.replace(/\\/g, '/'); // use only forward slashes
    out.push('SF:' + fileName);
    var statements = fileInfos.code.src;
    var execCount;
    var realLines = {};
    var lineNumber = 0;
    var statementDetails = fileInfos.statements.detail;
    for (var i = 1, l = statements.length; i <= l; i++) {
        var curStatement = statements[i - 1];
        var statementKey = curStatement.l;
        if (statementKey) {
            execCount = statementDetails[statementKey];

            // TODO: perhaps replace this with something smarter (by changing node-coverage):
            var matchLineNumber = /^[^0-9]*([0-9]+)_[0-9]+$/.exec(statementKey);
            lineNumber = 1 + parseInt(matchLineNumber[1], 10);

            var currentNumber = realLines[lineNumber];

            if (currentNumber == null || execCount < currentNumber) {
                // if several instructions are on the same line, keep the lowest execution count
                realLines[lineNumber] = execCount;
            }
        }
    }
    var linesInstrumented = 0;
    var linesCovered = 0;
    for (lineNumber in realLines) {
        execCount = realLines[lineNumber];
        if (execCount > 0) {
            linesCovered++;
        }
        linesInstrumented++;
        out.push('DA:' + lineNumber + ',' + execCount);
    }
    out.push('LH:' + linesCovered);
    out.push('LF:' + linesInstrumented);
    out.push('end_of_record');
};

module.exports = function (coverage) {
    var out = [];
    var files = coverage.files;
    for (var curFile in files) {
        if (files.hasOwnProperty(curFile)) {
            processFile(out, curFile, files[curFile]);
        }
    }
    return out.join('\n');
};