/* globals describe, it, beforeEach, afterEach, expect */
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

describe("core", function () {
    afterEach(function (done) {
        attester.__reset__().then(done);
    });

    it("reset", function (done) {
        // Start a campaign and then reset attester, both should work properly
        startCampaign(function () {
            attester.__reset__().then(function () {
                startCampaign(done);
            });
        });
    });
});

function startCampaign(callback) {
    attester.config.set({
        "phantomjs-instances": 1
        // enable debug logging
        //, "log-level": 4
    });

    attester.campaign.create(attester.config.readFile(path.join(__dirname, "campaign/simpleTest.yaml")));

    attester.event.once("attester.core.idle", function () {
        process.nextTick(callback);
    });
    attester.event.once("attester.core.fail", function () {
        throw "Didn't expect to fail";
    });
    attester.event.once("reports.stats", function (stats) {
        expect(stats.testCases).toBe(2);
        expect(stats.errors).toBe(0);
        expect(stats.failures).toBe(0);
    });

    attester.start();
}