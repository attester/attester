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

var Browser = require("../../lib/test-campaign/browser.js");

describe("parse browser config", function () {

    describe("core tests", function () {
        it("should read plain browser name", function () {
            expect(Browser.parseBrowserConfig("IE")).toEqual({
                browserName: "IE",
                browserVersion: undefined,
                os: undefined,
                logDisplayName: undefined
            });
        });

        it("should read name with version", function () {
            expect(Browser.parseBrowserConfig("IE 10")).toEqual({
                browserName: "IE",
                browserVersion: "10",
                os: undefined,
                logDisplayName: undefined
            });
        });

        it("should read name with semver", function () {
            expect(Browser.parseBrowserConfig("Firefox >=22")).toEqual({
                browserName: "Firefox",
                browserVersion: ">=22",
                os: undefined,
                logDisplayName: undefined
            });
        });

        it("should read name with os", function () {
            expect(Browser.parseBrowserConfig("Chrome on Windows 7")).toEqual({
                browserName: "Chrome",
                browserVersion: undefined,
                os: "Windows 7",
                logDisplayName: undefined
            });
        });

        it("should read name with semver and os", function () {
            expect(Browser.parseBrowserConfig("Chrome 30 on Windows 7")).toEqual({
                browserName: "Chrome",
                browserVersion: "30",
                os: "Windows 7",
                logDisplayName: undefined
            });
        });

        it("should read name with semver and alias", function () {
            expect(Browser.parseBrowserConfig("Firefox ~25 as Firefox Nightly")).toEqual({
                browserName: "Firefox",
                browserVersion: "~25",
                os: undefined,
                logDisplayName: "Firefox Nightly"
            });
        });

        it("should read name with version, os, and alias", function () {
            expect(Browser.parseBrowserConfig("Chrome 30 on Desktop Linux as Chrome Canary Linux")).toEqual({
                browserName: "Chrome",
                browserVersion: "30",
                os: "Desktop Linux",
                logDisplayName: "Chrome Canary Linux"
            });
        });
    });

    describe("whitespace and special chars tests", function () {
        it("should not care about whitespace", function () {
            expect(Browser.parseBrowserConfig("   Chrome    30   on   Desktop Linux    as    Chrome Canary 30   ")).toEqual({
                browserName: "Chrome",
                browserVersion: "30",
                os: "Desktop Linux",
                logDisplayName: "Chrome Canary 30"
            });
        });

        it("should allow special chars in alias", function () {
            expect(Browser.parseBrowserConfig("Chrome 30 on Desktop Linux as Chrome/Linux")).toEqual({
                browserName: "Chrome",
                browserVersion: "30",
                os: "Desktop Linux",
                logDisplayName: "Chrome/Linux"
            });
        });
    });

    describe("non-standard input tests", function () {
        it("should return empty object (unrestricted browser) for empty input string", function () {
            expect(Browser.parseBrowserConfig("")).toEqual({});
        });

        it("should return empty object (unrestricted browser) for null input string", function () {
            expect(Browser.parseBrowserConfig(null)).toEqual({});
        });

        it("should return 'unparsable browser' for no match", function () {
            expect(Browser.parseBrowserConfig("I have no idea what I'm passing")).toEqual({
                browserName : "unparsable browser"
            });
        });
    });

});