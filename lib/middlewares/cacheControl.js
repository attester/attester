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

/**
 * Enable browser cache for some requests, disable for the rest. Whitelist takes precedence over the blacklist.
 */
module.exports = function (args) {
    var logger = args.logger;
    var cacheEnabled = args.cacheEnabled || false;
    var cacheWhiteList = args.cacheWhiteList || null;
    var cacheBlackList = args.cacheBlackList || null;
    var nbRequests = 0;

    logger.logDebug("Browser caching is " + (cacheEnabled ? "enabled" : "disabled"));
    if (cacheEnabled) {
        logger.logDebug("Cache whitelist : " + (cacheWhiteList || "").toString());
        logger.logDebug("Cache blacklist : " + (cacheBlackList || "").toString());
    }

    return function (req, res, next) {
        var url = req.url;
        var allowCache = cacheEnabled && (url.match(cacheWhiteList) || !url.match(cacheBlackList));

        if (allowCache) {
            res.setHeader('Cache-Control', 'public, max-age=3600');
        } else {
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', 'Sat, 1 Jan 2000 12:00:00 GMT');
        }

        ++nbRequests;
        if (nbRequests % 50 === 0) {
            logger.logDebug("IO: " + nbRequests + " requests processed");
        }
        next();
    };
};