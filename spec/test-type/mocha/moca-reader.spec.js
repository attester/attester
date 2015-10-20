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

describe("Mocha test type", function () {
    var mochaTestType = require('../../../lib/test-type/mocha/mocha-test-type.js');
    mochaTestType = mochaTestType(require("../../../lib/attester"));

    it("should build the correct list of tests", function (callback) {
        var config = {
            files: {
                includes: ["spec/test-type/mocha/sample-tests/**/*.js"],
                excludes: ["**/syntaxError*", "**/*.txt"]
            }
        };

        var expected = [{
            name: "spec/test-type/mocha/sample-tests/asyncTest.js",
            url: "test.html?name=" + encodeURIComponent("spec/test-type/mocha/sample-tests/asyncTest.js")
        }, {
            name: "spec/test-type/mocha/sample-tests/simpleTest.js",
            url: "test.html?name=" + encodeURIComponent("spec/test-type/mocha/sample-tests/simpleTest.js")
        }];

        var type = new mochaTestType({}, config);
        type.init(function () {
            for (var i = 0; i < expected.length; i += 1) {
                expect(type.testsTrees).toContain(expected[i]);
            }
            expect(type.testsTrees.length).toEqual(expected.length);
            callback();
        });
    });
});
