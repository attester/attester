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
var fs = require("fs");
var url = require("url");
var querystring = require("querystring");

/**
 * Serve a page with lodash template. This method must be bound to a scope object containing
 * - data: the data passed to the template
 * - page: the requested page, starting with forward slash
 * - path: the path for the requested page as stored on disk
 *
 * The template data will contain
 * - data: the data bound to this template
 * - url: the parsed url of this request
 * - query: the parsed query string
 */
module.exports = function (req, res, next) {
    var model = this.data;
    var page = this.page;
    var path = this.path;
    var parsedUrl = url.parse(req.url);
    var query = querystring.parse(parsedUrl.query);

    if (parsedUrl.pathname != page) {
        return next();
    }

    fs.readFile(path, "utf-8", function (err, data) {
        if (err) {
            return next(err);
        }

        var pageContent = _.template(data.toString(), {
            data: model,
            url: parsedUrl,
            query: query
        });

        res.setHeader("Content-Type", "text/html;charset=utf-8");
        res.write(pageContent);
        res.end();
    });
};