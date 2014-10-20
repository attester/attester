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
 * This module is used to create campaigns from a configuration object.
 * It also handles the campaign life-cycle
 *
 * You can create a new campaign calling the method <code>create</code>
 * This will notify attester that a new campaign is available
 */
var attester = require("../attester");
var merge = require("../util/merge");

var campaign = module.exports = {};

// Default values for a campaign object
var getDefaults = function () {
    return {
        'coverage': null,
        'resources': {
            '/': []
        },
        'test-reports': {
            'json-log-file': [],
            'json-file': [],
            'xml-file': [],
            'xml-directory': []
        },
        'coverage-reports': {
            'json-file': [],
            'lcov-file': []
        }
        // browsers by default is missing to let it run on whatever browser is connected
    };
};

/**
 * @param {Object} campaign configuration object
 * @param {Object} override configuration object
 * @param {Number} campaignNumber Used if predictableUrls option was enabled.
 * @return {Object} JSON with campaign configuration
 */
campaign.create = function (campaign, override, campaignNumber) {
    var campaignConfig = getDefaults();
    if (override && override.resources) {
        // "array-ify" entries in resources so they can get merged properly
        for (var key in override.resources) {
            if (override.resources.hasOwnProperty(key) && !Array.isArray(override.resources[key])) {
                override.resources[key] = [override.resources[key]];
            }
        }
    }
    merge(campaignConfig, campaign);
    merge(campaignConfig, override || {});
    campaignConfig.predictableUrls = attester.config['predictable-urls'];
    campaignConfig.campaignNumber = campaignNumber;
    campaignConfig.liveResults = attester.config['live-results'];

    var json = attester.config.parse(campaignConfig);

    attester.event.emit("campaign.create", json);
    return json;
};