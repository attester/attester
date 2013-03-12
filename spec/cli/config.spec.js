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

var config = require("../../lib/config");
var path = require("path");

var expectedObject = {
    resources : {
        "/here" : ["there", "nowhere"],
        "/" : []  // by default
    },
    tests : {
        "aria-templates" : {
            classpaths : {
                includes : ["MainTestSuite"],
                excludes : ["test.sample.MyUnfinishedTest"]
            },
            rootFolderPath : '/',
            debug : true,
            memCheckMode : true
        },
        mocha : {
            files : {
                includes : ["test/all/*.js"]
            },
            ui : "bdd"
        }
    },
    coverage : {
        files : {
            rootDirectory : "js",
            includes : ["**/*"]
        }
    },
    "test-reports" : {
        "json-file" : ["report.json"],
        // defaults
        "json-log-file": [],
        "xml-file": [],
        "xml-directory": []
    },
    "coverage-reports" : {
        "json-file" : ["coverage.json"],
        "lcov-file": []
    },
    "browsers" : [{
        browserName : "PhantomJS"
    }, {
        browserName : "IE",
        majorVersion : 9
    }]
};

describe("read configuration files", function () {
    it("should read yml files", function () {
        var read = config.readConfig(path.join(__dirname, "configurations/yaml.yml"), {
            tests : {
                mocha : {
                    files : {
                        includes : ["test/all/*.js"]
                    },
                    ui : "bdd"
                }
            }
        });

        expect(read).toEqual(expectedObject);
    });

    it("should read json files", function () {
        var read = config.readConfig(path.join(__dirname, "configurations/json.json"), {
            "coverage-reports" : {
                "json-file" : ["coverage.json"]
            },
            "browsers" : [{
                "browserName" : "PhantomJS"
            }, {
                "browserName" : "IE",
                "majorVersion" : 9
            }]
        });

        expect(read).toEqual(expectedObject);
    });
});