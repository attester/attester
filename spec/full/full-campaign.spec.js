/* globals expect, describe, it, beforeEach, afterEach, runs, waitsFor */
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

var path = require("path");
var fs = require("fs");

var xml2js = require("xml2js");
var rimraf = require("rimraf");

var utils = require("../test-utils");

describe("Complete test suite", function () {
    it("runs properly", function () {
        var options = {
            testCase: 'full/campaign.yaml',
            args: [path.join(__dirname, "campaign.yaml")],
            results: {
                run: 4,
                failures: 0,
                errors: 0,
                skipped: 0
            },
            timeout: 10000,
            spawnOpts: {
                cwd: __dirname
            }
        };
        var finished = false;
        runs(function () {
            utils.runFromCommandLine(options, function (code, testExecution, errorMessages) {
                expect(code).toEqual(0);
                expect(testExecution).toEqual(options.results);
                expect(errorMessages.length).toEqual(0);

                finished = true;
            });
        });
        waitsFor(function () {
            return finished;
        }, options.timeout + 100, 'attester to complete');

        runs(function () {
            // Check the output has been written correctly

            // node-coverage report
            var json = JSON.parse(fs.readFileSync(path.join(__dirname, "out/coverage.json")));
            expect(json.global.statements.percentage).toEqual(88);

            // lcov report
            var lcov = fs.readFileSync(path.join(__dirname, "out/coverage.lcov")).toString();
            expect(lcov.indexOf("DA:30,0")).not.toBe(-1);

            // xml report
            var xml;
            xml2js.parseString(fs.readFileSync(path.join(__dirname, "out/report.xml")), function (err, res) {
                xml = res;
            });
            expect( !! xml.testsuite).toBe(true);

            // xml folder
            expect(fs.existsSync(path.join(__dirname, "out/xml"))).toBe(true);

            // and now delete the temporary folder
            rimraf.sync(path.join(__dirname, "out"));
        });
    });
});