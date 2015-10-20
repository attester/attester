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

var attester = require("../../lib/attester");

describe("plugin configuration", function () {

    // Set the configuration through plugins.config
    describe("plugins.config", function () {

        it("sets the configuration", function () {
            // This is a setter, what the user would normally write
            attester.plugins.config("my-plugin", {
                one: 1,
                two: "a number"
            });

            // This is a getter, what the plugin developer would normally write
            var config = attester.plugins.config("my-plugin");
            expect(config).toEqual({
                one: 1,
                two: "a number"
            });

            // When setting multiple times it resets the other options, no merging
            attester.plugins.config("my-plugin", {
                one: "a string this time"
            });
            config = attester.plugins.config("my-plugin");
            expect(config).toEqual({
                one: "a string this time"
            });
        });

        it("doesn't allow modification", function () {
            var initialConfig = {
                one: 1
            };
            attester.plugins.config("my-plugin", initialConfig);
            // Modify the reference of the initial config
            initialConfig.one = 2;

            var config = attester.plugins.config("my-plugin");
            expect(config).toEqual({
                one: 1
            });

            // Modify the reference of what I've just received
            config.one = 2;
            config = attester.plugins.config("my-plugin");
            expect(config).toEqual({
                one: 1
            });
        });

        it("doesn't throw", function () {
            var config = attester.plugins.config("never-configured");
            expect(config).toEqual({});
            // shouldn't raise exceptions
        });

    });

    // As a shortcut, set the configuration also from plugins.require
    describe("plugins.require", function () {
        beforeEach(function (done) {
            attester.plugins.__reset__().then(done);
        });
        afterEach(function (done) {
            attester.plugins.__reset__().then(done);
        });

        it("sets the configuration", function () {
            attester.plugins.require("a-plugin", {
                number: 12
            });

            var config = attester.plugins.config("a-plugin");
            expect(config).toEqual({
                number: 12
            });
        });
    });
});
