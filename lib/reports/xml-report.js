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

var xmlSpecialChars = [{
    search: /&/g,
    replace: '&amp;'
},
{
    search: /</g,
    replace: '&lt;'
},
{
    search: />/g,
    replace: '&gt;'
},
{
    search: /"/g,
    replace: '&quot;'
},
{
    search: /'/g,
    replace: '&apos;'
}];
var testNameSpecialChars = /[^._a-zA-Z0-9]+/g;
var endingUnderscores = /_+$/;

function escapeXML(value) {
    value = value + '';
    for (var i = 0, l = xmlSpecialChars.length; i < l; i++) {
        var specChar = xmlSpecialChars[i];
        value = value.replace(specChar.search, specChar.replace);
    }
    return value;
}

function filterTestName(name) {
    if (name) {
        name = name + '';
        name = name.replace(testNameSpecialChars, '_');
        name = name.replace(endingUnderscores, '');
    } else {
        name = "Unknown_test";
    }
    return name;
}

function getReportContent(jsonReport, fixedLevels) {
    var res = ['<?xml version="1.0" encoding="UTF-8" ?>\n'];

    function processError(error) {
        var tagName = error.failure ? "failure" : "error";
        res.push('<', tagName, ' message="', escapeXML(error.message), '">');
        res.push(escapeXML(error.message), '\n');
        var stack = error.stack;
        if (stack) {
            for (var i = 0, l = stack.length; i < l; i++) {
                var stackItem = stack[i];
                res.push('\tat ');
                if (stackItem.className) {
                    res.push(escapeXML(stackItem.className));
                    if (stackItem['function']) {
                        res.push('.');
                    }
                }
                res.push(escapeXML(stackItem['function']));
                res.push('(', escapeXML(stackItem.file), ':', escapeXML(stackItem.line), ')\n');
            }
        }
        res.push('\n');
        res.push('</', tagName, '>');
    }

    function processErrorsArray(errors) {
        for (var i = 0, l = errors.length; i < l; i++) {
            processError(errors[i]);
        }
    }

    function processTest(test, first) {
        var subItems = test.subTasks || test.subTests;
        if (subItems) {
            res.push('<testsuite name="', filterTestName(test.name), '"');
        } else {
            res.push('<testcase name="', filterTestName(test.method || test.name), '" classname="', filterTestName(test.name), '"');
        }
        if (test.duration != null /* can be 0 */ ) {
            res.push(' time="', test.duration / 1000, '"');
        }
        res.push('>');
        if (!subItems && test.ignored) {
            res.push('<skipped/>');
        }
        if (test.errors) {
            processErrorsArray(test.errors);
        }
        if (subItems) {
            processTestsArray(subItems);
            res.push('</testsuite>');
        } else {
            res.push('</testcase>');
        }
    }

    function processTestsArray(array) {
        for (var i = 0, l = array.length; i < l; i++) {
            processTest(array[i]);
        }
    }

    if (jsonReport.subTasks || jsonReport.subTests) {
        processTest(jsonReport);
    } else {
        processTest({
            name: jsonReport.name,
            subTests: [jsonReport]
        });
    }
    return res.join('');
}

function xmlDirectoryReport(report) {
    var reports = [];
    for (var i = 0, l = report.length; i < l; i++) {
        var curItem = report[i];
        reports.push({
            name: "TEST-" + filterTestName(curItem.name) + ".xml",
            content: getReportContent(curItem, true)
        });
    }
    return reports;
}

function xmlFileReport(item) {
    return getReportContent(item, false);
}

module.exports = {
    xmlFileReport: xmlFileReport,
    xmlDirectoryReport: xmlDirectoryReport
};