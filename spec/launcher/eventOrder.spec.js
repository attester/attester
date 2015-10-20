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

var attester = require("../../lib/attester");
var event = attester.event;

describe("order of events", function () {
    var received;
    beforeEach(function () {
        received = [];

        var storeEvent = function (data) {
            received.push([this.event, data.slaveURL || data]);
        };

        event.once("attester.server.attached", storeEvent);
        event.once("launcher.connect", storeEvent);
    });

    afterEach(function (done) {
        // Restore the launcher to the initial state
        attester.launcher.__reset__().then(function () {
            attester.launcher.__init__();
        }).then(done);
    });

    it("should respect ordered events", function (done) {
        event.emit("attester.server.attached", {
            slaveURL: "abc"
        });
        process.nextTick(function () {
            event.emit("attester.campaign.tasksList");

            process.nextTick(function () {
                expect(received).toEqual([
                    ["attester.server.attached", "abc"],
                    ["launcher.connect", "abc"]
                ]);
                done();
            });
        });
    });

    it("should invert the events", function (done) {
        event.emit("attester.campaign.tasksList");
        process.nextTick(function () {
            event.emit("attester.server.attached", {
                slaveURL: "abc"
            });

            process.nextTick(function () {
                expect(received).toEqual([
                    ["attester.server.attached", "abc"],
                    ["launcher.connect", "abc"]
                ]);
                done();
            });
        });
    });
});
