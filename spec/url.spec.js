/* globals expect, describe, it, beforeEach, afterEach */
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

var url = require("../lib/url");

describe("URL", function () {
    it("normalization", function () {
        // root path
        expect(url.normalize("root")).toEqual("/root");
        expect(url.normalize("/root")).toEqual("/root");
        expect(url.normalize("./root")).toEqual("/root");
        expect(url.normalize("../root")).toEqual("/root");
        expect(url.normalize("../")).toEqual("/");
        expect(url.normalize("./")).toEqual("/");
        expect(url.normalize("/")).toEqual("/");
        expect(url.normalize("")).toEqual("/");

        // navigation paths
        expect(url.normalize("a/..//b/c")).toEqual("/b/c");
        expect(url.normalize("/a///.//b/c")).toEqual("/a/b/c");
        expect(url.normalize("/a/b/c/..")).toEqual("/a/b");
        expect(url.normalize("/a/b/c/.././")).toEqual("/a/b");

        // join
        expect(url.normalize("./a", "b", "c")).toEqual("/a/b/c");
        expect(url.normalize("./a", "/b", "/c")).toEqual("/a/b/c");
        expect(url.normalize("/a", "b//", "//c/")).toEqual("/a/b/c");
        expect(url.normalize("a", "b/./", "/../c/")).toEqual("/a/c");
        expect(url.normalize("/", "/", "/")).toEqual("/");
        expect(url.normalize("/", "../", "/..")).toEqual("/");
    });
});