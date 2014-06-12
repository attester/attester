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

var util = require("util");
var http = require("http");

var test_utils = require("../../test-utils");
var BaseTestType = require("../../../lib/test-type/base-test-type");

describe("base test type", function () {
    it("uses the correct middlewares", function (done) {
        var Type = function () {
            BaseTestType.call(this, {
                baseURL: "/"
            }, {});

            // Absolute path
            this.use("/client", function (req, res, next) {
                res.writeHead(200);
                res.end("client said " + req.url);
            });

            // Relative path
            this.use("rooms", function (req, res, next) {
                res.writeHead(200);
                res.end("joining room " + req.url);
            });

            // No path
            this.use(function (req, res, next) {
                res.writeHead(200);
                res.end("in general " + req.url);
            });
        };
        util.inherits(Type, BaseTestType);
        Type.prototype.name = "test";
        Type.prototype.type = "";

        var testType = new Type();

        test_utils.createServer(testType, "/there/might/be/stuff/", function (baseUrl, closeCallback) {
            assertRequests(baseUrl, [{
                url: "__attester__/client/lib.js",
                body: "client said /lib.js"
            },
            {
                url: "__attester__/rooms/empty",
                body: "joining room /empty"
            },
            {
                url: "__attester__/another/path",
                body: "in general /another/path"
            }], function () {
                closeCallback(done);
            });
        });
    });

    it("uses the correct test page", function (done) {
        var Type = function () {
            // This time use some configuration
            BaseTestType.call(this, {
                baseURL: "/"
            }, {
                version: "1.0",
                name: "attester"
            });

            // Override the base test page for easier assertion
            this.baseTestPage = "<%= head %><%= body %>";
            this.baseTestContent = "";

            this.testPage("/test.html", "<%= query.test %> on version <%= data.config.version %>");
            this.testPage("interactive.html", {
                body: ["<h1><%= data.config.name %></h1>",
                {
                    tagName: "script",
                    type: "loader",
                    content: "{}"
                }]
            });
        };
        util.inherits(Type, BaseTestType);
        Type.prototype.name = "test";
        Type.prototype.type = "";

        var testType = new Type();

        test_utils.createServer(testType, "/there/might/be/stuff/", function (baseUrl, closeCallback) {
            assertRequests(baseUrl, [{
                url: "__attester__/test.html?test=a.b.c",
                body: "a.b.c on version 1.0"
            },
            {
                url: "__attester__/interactive.html",
                body: "<h1>attester</h1><script type=\"loader\">{}</script>"
            }], function () {
                closeCallback(done);
            });
        });
    });
});

function assertRequests(baseUrl, requests, callback) {
    if (requests.length > 0) {
        var req = requests.shift();
        http.get(baseUrl + req.url, function (response) {
            var content = "";
            response.on("data", function (chunk) {
                content += chunk;
            });
            response.on("end", function () {
                expect(content).toEqual(req.body);
                process.nextTick(function () {
                    assertRequests(baseUrl, requests, callback);
                });
            });
        });
    } else {
        callback();
    }
}