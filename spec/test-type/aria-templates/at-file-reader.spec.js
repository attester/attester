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

describe('ATFileReader', function () {
    var readATFile = require('../../../lib/test-type/aria-templates/at-file-reader.js');
    var fs = require('fs');
    var path = require('path');
    var identity = function (value) {
        return value;
    };

    var itShouldInterpretSpecifically = function (folder, fileName, expectedResult, processResult) {
        processResult = processResult || identity;
        it('should correctly interpret ' + folder + '/' + fileName, function (done) {
            fs.readFile(path.join(__dirname, folder, fileName), 'utf8', function (err, data) {
                expect(err).toBeNull();
                var res = readATFile(data, fileName);
                res = processResult(res);
                expect(res).toEqual(expectedResult);
                done();
            });
        });
    };

    var itShouldInterpret = function (fileName, expectedResult, processResult) {
        itShouldInterpretSpecifically('require-sample-tests', fileName, expectedResult, processResult);
        itShouldInterpretSpecifically('legacy-sample-tests', fileName, expectedResult, processResult);
    };

    itShouldInterpret('SimpleTestSuite.js', {
        classpath: 'test.myCompany.MyTestSuite',
        testSuite: true,
        subTests: ['test.myCompany.firstModule.FirstModuleTestSuite', 'test.myCompany.secondModule.SearchTestCase', 'test.myCompany.secondModule.RetrieveTestCase']
    });

    itShouldInterpret('OtherSimpleTestSuite.js', {
        classpath: 'test.myCompany.MyTestSuite',
        testSuite: true,
        subTests: ['test.myCompany.firstModule.FirstModuleTestSuite', 'test.myCompany.secondModule.SearchTestCase', 'test.myCompany.secondModule.RetrieveTestCase']
    });

    itShouldInterpret('TestSuiteUsingPackage.js', {
        classpath: 'test.myCompany.MyTestSuite',
        testSuite: true,
        subTests: ['test.myCompany.MyTest1', 'test.myCompany.MyTest2', 'test.myCompany.MyTest3']
    });

    itShouldInterpret('MainTestSuite.js', {
        classpath: 'MainTestSuite',
        testSuite: true,
        subTests: ['MainTestSuiteTest1', 'Test2', 'MainTestSuiteTest3']
    });

    itShouldInterpret('OtherTestSuite.js', {
        classpath: 'MainTestSuite',
        testSuite: true,
        subTests: ['x.y.z.MyTest1', 'y.z.MyOtherTest2']
    });

    itShouldInterpret('SimpleTestCase.js', {
        classpath: 'test.myCompany.MyTestCase',
        testSuite: false
    });

    itShouldInterpret('MissingClasspathError.js', {
        error: {
            message: 'In %s: missing classpath in Aria.classDefinition.',
            args: ['MissingClasspathError.js']
        }
    });

    itShouldInterpret('SyntaxError.js', {
        error: {
            message: 'An exception occurred in %s: %s',
            args: ['SyntaxError.js', 'ERROR'],
            object: {}
        }
    }, function (value) {
        if (value.error && value.error.args && value.error.object) {
            // Don't check the exact error message:
            value.error.object = {};
            value.error.args[1] = 'ERROR';
        }
        return value;
    });

    itShouldInterpretSpecifically('legacy-sample-tests', 'MultipleTestCasesError.js', {
        error: {
            message: 'In %s: there is not exactly one call to Aria.classDefinition.',
            args: ['MultipleTestCasesError.js']
        }
    });

    itShouldInterpretSpecifically('legacy-sample-tests', 'ZeroClassDefError.js', {
        error: {
            message: 'In %s: there is not exactly one call to Aria.classDefinition.',
            args: ['ZeroClassDefError.js']
        }
    });

    itShouldInterpretSpecifically('require-sample-tests', 'MultipleTestCasesError.js', {
        error: {
            message: "Found several 'module.exports = Aria.classDefinition({...});' in %s: lines %s and %s.",
            args: ['MultipleTestCasesError.js', 4, 18]
        }
    });

    itShouldInterpretSpecifically('require-sample-tests', 'ZeroClassDefError.js', {
        error: {
            message: "Could not find 'var Aria = require(\"ariatemplates/Aria\"); module.exports = Aria.classDefinition({...});' in %s.",
            args: ['ZeroClassDefError.js']
        }

    });

});