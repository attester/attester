/* globals describe, it, beforeEach, afterEach, expect, runs, waitsFor */
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

var attester = require("../../lib/attester");

var utils = require("../test-utils");

describe("plugins", function () {
    beforeEach(function (done) {
        attester.__reset__(done);
    });

    it("loaded before the start", function (done) {
        console.log("test #plugins/load_plugins before start");

        // This is what the user would do in a module
        attester.config.set({
            "phantomjs-instances": 1
            // enable debug logging
            //, "log-level": 4
        });

        attester.plugins.require(path.join(__dirname, "mock/plugin.js"), {
            baseValue: 2
        });

        attester.campaign.create(attester.config.readFile(path.join(__dirname, "campaign/test.yaml")));

        attester.event.once("attester.core.idle", function () {
            done();
        });
        attester.event.once("attester.core.fail", function () {
            expect(false).toBe(true);
            done();
        });
        attester.start();
    });

    it("loaded after the start", function (done) {
        console.log("test #plugins/load_plugins after start");

        attester.config.set({
            "phantomjs-instances": 1
            // enable debug logging
            //, "log-level": 4
        });

        attester.event.once("attester.core.idle", function () {
            done();
        });
        attester.event.once("attester.core.fail", function () {
            expect(false).toBe(true);
            done();
        });
        attester.start();

        // I wouldn't advice people to use it this way though
        attester.plugins.require(path.join(__dirname, "mock/plugin.js"), {
            baseValue: 2
        });

        // Now start a test campaign using this plugin
        attester.campaign.create(attester.config.readFile(path.join(__dirname, "campaign/test.yaml")));
    });
});