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

var generator = require("../lib/page-generator");

describe("Page generator", function () {
    beforeEach(function () {
        this.addMatchers({
            toLookLikeTag: function (expectedTag) {
                this.message = function () {
                    return "Tag " + this.actual + " doesn't look like expected " + expectedTag;
                };

                // check the opening tag
                var opening = expectedTag.match(/^(<[a-z]+ )/)[1];
                if (this.actual.indexOf(opening) !== 0) {
                    return false;
                }

                // check the closing tag
                var closing = expectedTag.match(/(<\/[a-z]+>)$/)[1];
                if (this.actual.indexOf(closing) !== this.actual.length - closing.length) {
                    return false;
                }

                // what is left is the attributes and the content
                var splitActual = this.actual.substring(opening.length, this.actual.length - closing.length).split(">");
                var splitExpected = expectedTag.substring(opening.length, expectedTag.length - closing.length).split(">");

                // check the body tag
                if (splitActual[1].trim() !== splitExpected[1].trim()) {
                    return false;
                }

                // check the attributes in any order
                if (splitActual[0] === splitExpected[0]) {
                    return true;
                } else {
                    var actual = splitActual[0].split(" ").sort();
                    var expected = splitExpected[0].split(" ").sort();

                    if (actual.length !== expected.length) {
                        return false;
                    }

                    for (var i = 0; i < expected.length; i += 1) {
                        if (expected[i] !== actual[i]) {
                            return false;
                        }
                    }
                }

                return true;
            }
        });
    });

    it("generates scripts", function () {
        var script = "";
        // test defaults
        script = generator.script({
            src: "a.js"
        });
        expect(script).toLookLikeTag("<script src=\"a.js\" type=\"text/javascript\"></script>");

        // test all script properties
        script = generator.script({
            src: "b.js",
            one: "what",
            two: "matters?",
            content: "nothing matters",
            type: "x-text"
        });
        expect(script).toLookLikeTag("<script src=\"b.js\" type=\"x-text\" one=\"what\" two=\"matters?\">nothing matters</script>");
    });

    it("generates links", function () {
        var link = "";
        // test defaults
        link = generator.link({
            href: "a.css"
        });
        expect(link).toLookLikeTag("<link href=\"a.css\" rel=\"stylesheet\"></link>");

        // test all link properties
        link = generator.link({
            href: "b.css",
            rel: "another",
            "class": "inception",
            content: ".inception {\n\tcolor:red;\n}"
        });
        expect(link).toLookLikeTag("<link href=\"b.css\" rel=\"another\" class=\"inception\">.inception {\n\tcolor:red;\n}</link>");
    });

    it("generates template markup", function () {
        var html = generator.html("<b><%= name %></b>", {
            name: "tom"
        });
        expect(html).toEqual("<b>tom</b>");
    });

    it("generates template inside tag", function () {
        var script = generator.script({
            content: "var <%= framework %> = function () {};",
            src: "/<%= framework %>-<%= version.stable %>.js"
        }, {
            framework: "any",
            version: {
                stable: "1.0",
                beta: "1.1"
            }
        });
        expect(script).toLookLikeTag("<script type=\"text/javascript\" src=\"/any-1.0.js\">var any = function () {};</script>");
    });

    it("generates a page from a string", function () {
        var template = "-<%= head %>,<%= body %>|";
        var scope = {
            name: "page"
        };
        var page = generator.page(template, "A simple <%= name %>", scope);

        expect(page).toEqual("-,A simple page|");
    });

    it("generates a page with only head", function () {
        var template = "-<%= head %>,<%= body %>|";
        var scope = {
            name: "page"
        };
        var content = {
            head: "<<%= name %>>tag</<%= name %>>"
        };
        var page = generator.page(template, content, scope);

        expect(page).toEqual("-<page>tag</page>,|");
    });

    it("generates a page with tags", function () {
        var template = "<%= head %>-<%= body %>";
        var scope = {
            name: "page",
            role: "test"
        };
        var content = {
            head: {
                tagName: "link"
            },
            body: ["page: <%= name %>",
            {
                tagName: "h1",
                content: "<%= role %>"
            }]
        };
        var page = generator.page(template, content, scope);

        expect(page).toEqual("<link rel=\"stylesheet\"></link>-page: page<h1>test</h1>");
    });

    it("merges pages", function () {
        var template = "<%= head %>-<%= body %>";
        var scope = {
            name: "page",
            text: "string"
        };
        var one = {
            head: "<<%= name %>>tag</<%= name %>>"
        };
        var two = "<h1>Hello</h1>";
        var three = {
            head: ["random ", "<%= text %>"],
            body: {
                tagName: "script",
                type: "nothing"
            }
        };

        var merged = generator.merge(one, two, three);
        var page = generator.page(template, merged, scope);

        expect(page).toEqual("<page>tag</page>random string-<h1>Hello</h1><script type=\"nothing\"></script>");
    });

    it("generates pages with attributes listeners", function () {
        var template = "<%= head %>-<%= body %>";
        var prefixURL = function (tag, url) {
            return "/prefix/" + url;
        };
        var listeners = {
            href: prefixURL,
            type: prefixURL
        };
        var content = {
            head: [{
                tagName: "script",
                type: "javascript"
            }],
            body: [{
                tagName: "a",
                href: "somewhere"
            },
            {
                tagName: "b",
                content: "Hello"
            }]
        };
        var page = generator.page(template, content, null, listeners);

        expect(page).toEqual("<script type=\"/prefix/javascript\"></script>-<a href=\"/prefix/somewhere\"></a><b>Hello</b>");
    });
});