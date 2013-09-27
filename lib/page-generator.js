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

var _ = require("lodash");

var merge = require("./merge");

/**
 * This module allows to build page elements from a JSON description.
 * Possible elements are
 *
 * - script
 * - link
 * - html
 */

/**
 * Create a script tag from the description
 * {
 *     type : "text/javascript", //default
 *     src : "",
 *     any-other-attribute : "",
 *     content : "" // what's inside the tag
 * }
 * The optional scope is used passed to the template engine to generate the content and the attribute values
 */
exports.script = function (description, scope, attributesGenerator) {
    return tag("script", {
        type: "text/javascript"
    }, description, scope, attributesGenerator);
};

/**
 * Create a link tag from the description
 * {
 *     rel : "stylesheet", //default
 *     src : "",
 *     any-other-attribute : "",
 *     content : "" // what's inside the tag
 * }
 * The optional scope is used passed to the template engine to generate the content and the attribute values
 */
exports.link = function (description, scope, attributesGenerator) {
    return tag("link", {
        rel: "stylesheet"
    }, description, scope, attributesGenerator);
};

/**
 * Generate some generic HTML using lodash template.
 * scope is the data passed to the template method
 */
exports.html = function (content, scope) {
    return _.template(content, scope);
};

/**
 * Generate a complete page starting from a given template.
 * 
 * The template should have placeholders for
 * <%= head %> elements to be added to the head sections
 * <%= body %> elements to be added to the body sections
 *
 * content can be
 * 1. a string, in this case it'll be added to the body
 * 2. an object with head and body that in turn could be
 * - a. a string added to the respective section
 * - b. an array of strings and tag elements where tagName specifies the name
 * - c. a single tag element
 *
 * For example
 * 1. content : "<h1>In the body</h1>"
 * 2. content : {
 *     head : "<meta name='description' content='attester'>",
 *     body : [
 *         "<b>a string</b>",
 *         {
 *             tagName : "script",
 *             src : "/lib.js"
 *         },
 *         "another string using templates <%= scope.name %>"
 *     ]
 * }
 * 2.c. content : {
 *     head : {
 *         tagName : "link",
 *         href : "/style.css"
 *     }
 * }
 *
 * Any string is considered as a template receiving as data the object 'scope'
 *
 * It is also possible to add attribute generator for dynamic tags.
 *
 * {
 *     href: function (tag, generatedURL) {
 *         return "/my_prefix" + generatedURL;
 *     },
 *     anotherAttribute: function (tag, computedValue) {}
 * }
 *
 * The listener is called for any tag that has an 'href' attribute.
 */
exports.page = function (template, content, scope, attributesGenerator) {
    var data = {
        head: "",
        body: ""
    };

    var description = normalizePage(content);
    description = uniformHead(description);

    ["head", "body"].forEach(function (section) {
        var sectionContent = description[section];

        sectionContent.forEach(function (element) {
            if (_.isString(element)) {
                data[section] += _.template(element, scope);
            } else if (element.tagName) {
                var tagName = element.tagName;

                data[section] += exports[tagName] ? exports[tagName](element, scope, attributesGenerator) : tag(tagName, null, element, scope, attributesGenerator);
            }
        });
    });

    return _.template(template, data);
};

/**
 * Merge together any number of page descriptions.
 * It doesn't generate the page
 */
exports.merge = function ( /* ...descriptions */ ) {
    var base = {
        "head-start": [],
        "head": [],
        "head-end": [],
        body: []
    };

    for (var i = 0; i < arguments.length; i += 1) {
        var page = normalizePage(arguments[i]);
        merge(base, page);
    }

    return base;
};

/**
 * Given any acceptable page description, generate an object with head and body as arrays.
 * Normalized pages can be merged easily
 */

function normalizePage(content) {
    var data = {
        "head-start": [],
        "head": [],
        "head-end": [],
        body: []
    };

    if (typeof content === "string") {
        data.body.push(content);
    } else {
        ["head-start", "head", "head-end", "body"].forEach(function (section) {
            var sectionContent = content[section];
            if (!sectionContent) {
                return;
            }

            if (!_.isArray(sectionContent)) {
                data[section].push(sectionContent);
            } else {
                data[section] = sectionContent;
            }
        });
    }

    return data;
}

function uniformHead(description) {
    description.head = description.head || {};
    var headStart = description["head-start"];
    var headEnd = description["head-end"];
    var head = description.head;

    var currElem;

    // push to the beginning of head
    if (Array.isArray(headStart)) {
        while ((currElem = headStart.shift()) != null) {
            head.unshift(currElem);
        }
        delete description["head-start"];
    }

    // push to the end of head
    if (Array.isArray(headEnd)) {
        while ((currElem = headEnd.shift()) != null) {
            head.push(currElem);
        }
        delete description["head-end"];
    }

    return description;
}

function tag(name, defaults, description, scope, attributesGenerator) {
    var config = defaults || {};
    var data = scope || {};
    merge(config, description);

    // opening tag
    var markup = "<" + name;
    var all = [];
    for (var attribute in config) {
        if (attribute !== "content" && attribute !== "tagName") {
            var value = _.template(config[attribute], data).replace(/"/g, "&#34;");
            if (attributesGenerator && attributesGenerator[attribute]) {
                value = attributesGenerator[attribute](config, value);
            }
            all.push(attribute + '="' + value + '"');
        }
    }
    if (all.length > 0) {
        markup += " " + all.join(" ");
    }
    markup += ">";

    // content
    if (config.content) {
        markup += _.template(config.content, data);
    }

    // closing tag
    markup += "</" + name + ">";

    return markup;
}