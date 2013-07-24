/*globals describe, it, runs, waitsFor, expect, beforeEach, afterEach */
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

var attester = require("../../lib/attester");

describe("campaign life-cycle", function () {
    // Prevent the server from starting and reports from being written
    var originalStart = attester.server.create;
    var originalWrite = attester.reports.writeReports;
    var writeReportsCalled = 0;
    var events = {
        "campaign.finished": 0,
        "campaign.failed": 0,
        "core.fail": 0,
        "core.idle": 0
    };

    function rememberEvents() {
        var shortName = this.event.substring("attester.".length);
        if (shortName in events) {
            events[shortName] += 1;
        }
    }
    var campaigns = [];

    function storeCampaign(campaign) {
        campaigns.push(campaign);
    }

    beforeEach(function () {
        // Disconnects the actual implementation of server, so that it doesn't react to events
        attester.server.__reset__();
        attester.server.create = function (callback) {
            callback();
        };
        attester.reports.writeReports = function (campaign, callback) {
            writeReportsCalled += 1;
            // assume that writing works fine if not specified by the test
            callback(campaign.reportError !== true);
        };
        // Register events
        events["campaign.finished"] = 0;
        events["campaign.failed"] = 0;
        events["core.fail"] = 0;
        events["core.idle"] = 0;
        attester.event.on("attester.*.*", rememberEvents);
        // Disconnect also the command line that would close the process
        attester.cli.__reset__();
        writeReportsCalled = 0;
        campaigns = [];
        attester.event.on("attester.campaign.created", storeCampaign);
    });

    afterEach(function () {
        attester.server.create = originalStart;
        attester.server.__init__();
        attester.reports.writeReports = originalWrite;
        attester.cli.__init__();
        attester.event.off("attester.*.*", rememberEvents);
        attester.event.off("attester.campaign.created", storeCampaign);
    });

    it("should end properly", function () {
        // The command line might create campaigns before we call start
        attester.campaign.create({
            "/": "one"
        });
        attester.campaign.create({
            "/": "two"
        });

        attester.start();

        // So far there are two campaigns
        expect(campaigns.length).toEqual(2);

        // Say that the first one finished
        campaigns[0].emit("finished");

        // I expect the campaign reports to be written already, but attester doesn't close
        expect(writeReportsCalled).toEqual(1);
        expect(events["campaign.finished"]).toEqual(1);
        expect(events["core.idle"]).toEqual(0);

        // I should still be able to create campaigns
        attester.campaign.create({
            "/": "three"
        });
        expect(campaigns.length).toEqual(3);

        // If the second campaign finished I should still wait for the third one
        campaigns[1].emit("finished");
        expect(writeReportsCalled).toEqual(2);
        expect(events["campaign.finished"]).toEqual(2);
        expect(events["core.idle"]).toEqual(0);

        // If by accident a campaign finished twice I shouldn't react
        // this is mainly to check that events are unregistered properly
        campaigns[0].emit("finished");
        expect(writeReportsCalled).toEqual(2);
        expect(events["campaign.finished"]).toEqual(2);
        expect(events["core.idle"]).toEqual(0);

        // And finally when the third campaign finishes I should end attester
        campaigns[2].emit("finished");
        expect(writeReportsCalled).toEqual(3);
        expect(events["campaign.finished"]).toEqual(3);
        expect(events["core.idle"]).toEqual(1);
    });

    it("should end with errors", function () {
        attester.campaign.create({
            "/": "error"
        });
        attester.campaign.create({
            "/": "works"
        });

        attester.start();

        // Say that the first one finished with an error
        campaigns[0].reportError = true;
        campaigns[0].emit("finished");

        // I expect the campaign reports to be written already, but attester doesn't close
        expect(writeReportsCalled).toEqual(1);
        expect(events["campaign.finished"]).toEqual(0);
        expect(events["campaign.failed"]).toEqual(1);
        expect(events["core.idle"]).toEqual(0);

        // If the second campaign finishes without error, attester should still report an error
        campaigns[1].emit("finished");
        expect(writeReportsCalled).toEqual(2);
        expect(events["campaign.finished"]).toEqual(1);
        expect(events["campaign.failed"]).toEqual(1);
        expect(events["core.idle"]).toEqual(0);
        expect(events["core.fail"]).toEqual(1);
    });
});