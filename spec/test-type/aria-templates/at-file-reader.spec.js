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

    var itShouldInterpret = function (fileName, expectedResult) {
        it('should correctly interpret ' + fileName, function (done) {
            fs.readFile(path.join(__dirname, 'sample-tests', fileName), 'utf8', function (err, data) {
                expect(err).toBeNull();
                var res = readATFile(data, fileName);
                expect(res).toEqual(expectedResult);
                done();
            });
        });
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

    itShouldInterpret('SimpleTestCase.js', {
        classpath: 'test.myCompany.MyTestCase',
        testSuite: false
    });

    itShouldInterpret('SyntaxError.js', {
        error: {
            message: 'An exception occurred in %s: %s',
            args: ['SyntaxError.js', 'SyntaxError: Unexpected identifier'],
            object: {}
        }
    });
});