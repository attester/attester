/* globals expect, describe, it, afterEach, beforeEach */
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

var attester = require("../../lib/attester");
var config = attester.config;

describe("read configuration files", function () {
    beforeEach(function (done) {
        attester.logger.__reset__().then(done);
    });
    afterEach(function (done) {
        attester.logger.__reset__().then(done);
    });

    it("should read yml files", function () {
        var read = config.readFile(path.join(__dirname, "files/valid.yml"));

        expect(read).toEqual({
            another: true
        });
    });

    it("should read yaml files", function () {
        var read = config.readFile(path.join(__dirname, "files/valid.yaml"));

        expect(read).toEqual({
            lot: ["a", "b", "c"]
        });
    });

    it("should read json files", function () {
        var read = config.readFile(path.join(__dirname, "files/valid.json"));

        expect(read).toEqual({
            one: 1,
            two: 2
        });
    });

    it("should fail with yaml", function () {
        var messages = [];
        attester.logger._mock({
            logError: function (message) {
                messages.push(message);
            }
        });

        config.readFile(path.join(__dirname, "files/invalid.yaml"));
        expect(messages.length).toEqual(1);
        expect(messages[0]).toContain("Unable to parse");
    });

    it("should fail with json", function () {
        var messages = [];
        attester.logger._mock({
            logError: function (message) {
                messages.push(message);
            }
        });

        config.readFile(path.join(__dirname, "files/invalid.json"));
        expect(messages.length).toEqual(1);
        expect(messages[0]).toContain("Unable to parse");
    });

    it("should fail with no file", function () {
        var messages = [];
        attester.logger._mock({
            logError: function (message) {
                messages.push(message);
            }
        });

        config.readFile(path.join(__dirname, "files/missing_file"));
        expect(messages.length).toEqual(1);
        expect(messages[0]).toContain("Error while opening");
    });
});