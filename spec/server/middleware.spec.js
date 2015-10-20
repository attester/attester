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

var http = require("http");
var events = require("events");
var util = require("util");

var attester = require("../../lib/attester");

describe("server", function () {
    beforeEach(function (done) {
        attester.__reset__().then(done);
    });

    it("middleware before create", function (done) {
        attester.server.use("/abc", function (req, res, next) {
            res.writeHead(200);
            res.end("middlware1 said " + req.url);
        });

        attester.server.create(function () {
            createCampaignAndFetchUrl("abc/one.js", function (content) {
                expect(content).toBe("middlware1 said /one.js");
                done();
            });
        });
    });

    it("middleware in the middle of create", function (done) {
        attester.server.create(function () {
            createCampaignAndFetchUrl("cde/two.js", function (content) {
                expect(content).toBe("middlware2 said /two.js");
                done();
            });
        });

        attester.server.use("/cde", function (req, res, next) {
            res.writeHead(200);
            res.end("middlware2 said " + req.url);
        });
    });

    // Note also that this test doesn't use a path for the middleware
    it("middleware after create", function (done) {
        attester.server.create(function () {
            attester.server.use(function (req, res, next) {
                res.writeHead(200);
                res.end("middlware3 said " + req.url);
            });

            createCampaignAndFetchUrl("any/three.js", function (content) {
                expect(content).toBe("middlware3 said /any/three.js");
                done();
            });
        });
    });
});

function createCampaignAndFetchUrl(url, callback) {
    // Add a fake campaign to get the slave URL
    var Campaign = function () {
        this.addResult = function (event) {
            var fullUrl = event.homeURL + url;
            http.get(fullUrl, function (response) {
                var content = "";
                response.on("data", function (chunk) {
                    content += chunk;
                });
                response.on("end", function () {
                    callback(content);
                });
            });
        };
        this.checkFinished = function () {
            return false;
        };
        events.EventEmitter.call(this);
    };
    util.inherits(Campaign, events.EventEmitter);

    var campaign = new Campaign();
    attester.server.addCampaign(campaign);
}
