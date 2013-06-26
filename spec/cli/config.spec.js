/* globals expect, describe, it */
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

var path = require("path");
var fs = require("fs");

var config = require("../../lib/config");

var expectedObject = {
    resources: {
        "/here": ["there", "nowhere"],
        "/": [] // by default
    },
    tests: {
        "aria-templates": {
            classpaths: {
                includes: ["MainTestSuite"],
                excludes: ["test.sample.MyUnfinishedTest"]
            },
            rootFolderPath: '/',
            debug: true,
            memCheckMode: true
        },
        mocha: {
            files: {
                includes: ["test/all/*.js"]
            },
            ui: "bdd"
        }
    },
    coverage: {
        files: {
            rootDirectory: "js",
            includes: ["**/*"]
        }
    },
    "test-reports": {
        "json-file": ["report.json"],
        // defaults
        "json-log-file": [],
        "xml-file": [],
        "xml-directory": []
    },
    "coverage-reports": {
        "json-file": ["coverage.json"],
        "lcov-file": []
    },
    "browsers": [{
        browserName: "PhantomJS"
    },
    {
        browserName: "IE",
        majorVersion: 9
    }]
};

describe("read configuration files", function () {
    it("should read yml files", function () {
        var read = config.readConfig(path.join(__dirname, "configurations/yaml.yml"), {
            tests: {
                mocha: {
                    files: {
                        includes: ["test/all/*.js"]
                    },
                    ui: "bdd"
                }
            }
        });

        expect(read).toEqual(expectedObject);
    });

    it("should read json files", function () {
        var read = config.readConfig(path.join(__dirname, "configurations/json.json"), {
            "coverage-reports": {
                "json-file": ["coverage.json"]
            },
            "browsers": [{
                "browserName": "PhantomJS"
            },
            {
                "browserName": "IE",
                "majorVersion": 9
            }]
        });

        expect(read).toEqual(expectedObject);
    });

    it("should read yml files with templates", function () {
        var configPath = path.join(__dirname, "configurations/template.yml");
        var envPath = path.join(__dirname, "configurations/env.yml");
        var read = config.readConfig(configPath, null, envPath);

        var packageJson = fs.readFileSync("package.json");

        expect(read.resources["/"]).toEqual(["here", "there"]);
        expect(read.tests["aria-templates"].bootstrap).toEqual('/aria/aria-templates-1.2.3.js');

        expect(read.env).toEqual({
            version: "1.2.3",
            name: "attester"
        });

        // test also missing properties
        expect(read.paths.notReplacing).toEqual("<%= missing %>");
    });

    it("should read json files with templates", function () {
        var configPath = path.join(__dirname, "configurations/template.json");
        var envPath = path.join(__dirname, "../../package.json");
        var read = config.readConfig(configPath, null, envPath);

        var packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../../package.json")));

        expect(read.resources["/"]).toEqual(["here", "there"]);
        expect(read.tests["aria-templates"].bootstrap).toEqual('/aria/aria-templates-' + packageJson.version + '.js');

        expect(read.env).toEqual(packageJson);

        // test also missing properties
        expect(read.paths.notReplacing).toEqual("<%= missing %>");
    });

    it("should read files with nested references", function () {
        var configPath = path.join(__dirname, "configurations/nested.yml");
        var read = config.readConfig(configPath);

        expect(read.one).toEqual("abcde");
        expect(read.two).toEqual("bcde");
        expect(read.three).toEqual("cde");
        expect(read.four).toEqual("d");
        expect(read.another).toEqual("de");
        expect(read.full).toEqual("abcde");
    });

    it("should fail nicely with circular references", function () {
        var configPath = path.join(__dirname, "configurations/circular.yml");
        var read = config.readConfig(configPath);

        expect(read.first).toEqual("<%= second %>");
        expect(read.second).toEqual("<%= third %>");
        expect(read.third).toEqual("<%= first %>");
    });
});
