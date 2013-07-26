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

var fs = require("fs");
var url = require("url");
var send = require("send");

/**
 * Serve a single static page.
 * It differs from connect.static because the latter serves a static folder instead of single file
 * This method must be bound to a scope object containing
 * - page: the requested page, starting with forward slash
 * - path: the path for the requested page as stored on disk
 */

module.exports = function (req, res, next) {
    var page = this.page;
    if (page.charAt(0) !== "/") {
        page = "/" + page;
    }
    var path = this.path;
    var parsedUrl = url.parse(req.url);

    if (parsedUrl.pathname != page) {
        return next();
    }

    send(req, path).on("error", next).pipe(res);
};