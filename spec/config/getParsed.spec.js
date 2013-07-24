/* globals expect, describe, it, afterEach, beforeEach */
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
var config = attester.config;

describe("Parse internal configuration values", function () {
    beforeEach(function () {
        config.__reset__();
    });
    afterEach(function () {
        config.__reset__();
    });
    it("should parse one level properties", function () {
        var configValue = {
            foo: "a",
            bar: "b<%= foo %>"
        };

        config.set(configValue);

        expect(config.getParsed("foo")).toEqual("a");
        expect(config.getParsed("bar")).toEqual("ba");
        expect(config.getParsed("baz")).toBeUndefined();

        // Set baz to be something that is not defined yet
        config.set({
            baz: "<%= another %>"
        });
        expect(config.getParsed("baz")).toEqual("<%= another %>");

        // And now set the missing value
        config.set({
            another: "a<%= bar %>d",
            foo: "c"
        });
        expect(config.getParsed("baz")).toEqual("abcd");
    });

    it("should parse multi level properties", function () {
        var configValue = {
            foo: "a",
            bar: {
                baz: {
                    qux: "b"
                }
            },
            all: "<%= foo %> : <%= bar.baz.qux %>"
        };

        config.set(configValue);

        expect(config.getParsed("bar.baz.qux")).toEqual("b");
        expect(config.getParsed("all")).toEqual("a : b");
    });

    it("should use shortcuts on config properties", function () {
        var configValue = {
            foo: "a",
            bar: {
                baz: {
                    qux: "b"
                }
            },
            all: "<%= foo %> : <%= bar.baz.qux %>"
        };

        config.set(configValue);

        expect(config.foo).toEqual("a");
        expect(config.all).toEqual("a : b");
        expect(config.bar.baz.qux).toEqual("b");
    });
});