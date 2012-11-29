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

var vm = require('vm');

var readATFileContent = function (fileContent, fileName) {
    var res = {};
    var classDef = null;
    var classDefinitionCalls = 0;
    var sandbox = {
        aria: {
            core: {
                Browser: {}
            }
        },
        Aria: {
            classDefinition: function (def) {
                classDefinitionCalls++;
                classDef = def || {};
            }
        }
    };
    try {
        vm.runInNewContext(fileContent, sandbox, fileName);
        if (classDefinitionCalls != 1) {
            res.error = {
                message: "In %s: there is not exactly one call to Aria.classDefinition.",
                args: [fileName]
            };
            return res;
        }
        res.classpath = classDef.$classpath;
        if (typeof res.classpath != "string") {
            res.error = {
                message: "In %s: missing classpath in Aria.classDefinition.",
                args: [fileName]
            };
            return res;
        }
        res.testSuite = (classDef.$extends == 'aria.jsunit.TestSuite');
        if (res.testSuite) {
            var lastDot = res.classpath.lastIndexOf('.');
            var testSuiteObject = {
                $TestSuite: {
                    constructor: function () {}
                },
                $classpath: res.classpath,
                $package: res.classpath.substring(0, lastDot),
                $class: res.classpath.substring(lastDot + 1),
                _tests: [],
                addTests: function () {
                    var args = arguments;
                    for (var i = 0, l = args.length; i < l; i++) {
                        var testClassPath = args[i];
                        if (typeof testClassPath == "string") {
                            this._tests.push(testClassPath);
                        }
                    }
                }
            };
            classDef.$constructor.call(testSuiteObject);
            res.subTests = testSuiteObject._tests.slice(0);
        }
    } catch (e) {
        res.error = {
            message: "An exception occurred in %s: %s",
            args: [fileName, e + ""],
            object: e
        };
        return res;
    }
    return res;
};

module.exports = readATFileContent;