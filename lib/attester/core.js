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

var Q = require('q');

var attester = require("../attester");
var config = attester.config;
var logger = attester.logger;

/**
 * This module acts as a coordinator. It listen to events raised by other modules
 * and controls them.
 *
 * For instance when a campaign is created it'll start the server if needed and
 * inform the launcher that a new campaign is waiting to be executed by slaves
 */

var core = module.exports = {};

core.__init__ = function () {
    attester.event.onAny(logAnyEvent);
    attester.event.on("*.error", gotAnError);
    attester.event.on("campaign.create", newCampaign);
};

function logAnyEvent(value) {
    logger.logDebug(this.event);
}

function gotAnError(message, params) {
    if (message) {
        logger.logError(message, params);
    }
    // else the message has already been logged before the event
    attester.event.emit("attester.core.fail");
}

var coreStarted = false;
/**
 * Start attester. This method creates a server and initializes all campaigns created so far.
 */
core.start = function () {
    if (coreStarted) {
        // Don't start twice
        logger.logDebug("attester already started");
        return;
    }

    attester.event.emit("attester.start");

    attester.server.create(function () {
        attester.event.emit("attester.server.started");
        coreStarted = true;
        createdCampaigns.forEach(initCampaign);
    });
};

/**
 * List of campaigns created so far. Campaigns are removed when they finish
 */
var createdCampaigns = [];
/**
 * Number of campaign failed so far
 */
var errorsSoFar = 0;

var newCampaign = function (configData) {
    var TestCampaign = require("../test-campaign/test-campaign.js");

    var campaign = new TestCampaign(configData, attester.logger);
    campaign.on("result", function (event) {
        attester.event.emit("attester.result", event);
    });
    campaign.on("finished", finishCampaign.bind(campaign));
    campaign.on("result-serverAttached", attester.event.forward("attester.server.attached"));
    campaign.on("result-tasksList", attester.event.forward("attester.campaign.tasksList"));

    createdCampaigns.push(campaign);

    // A new campaign has been created
    attester.event.emit("attester.campaign.created", campaign);

    if (coreStarted) {
        // Init is normally done by the start, so we'll have to call it
        initCampaign(campaign);
    }
};

function initCampaign(campaign) {
    logger.logDebug("Initialize campaign " + campaign.id);
    campaign.init(attester.event.emit.bind(attester.event, "attester.campaign.initialized", campaign));
}

// This method is bound to the campaign

function finishCampaign() {
    var campaign = this;
    logger.logDebug("Finishing campaign " + campaign.id);
    var found = markFinished(campaign);

    if (found) {
        attester.reports.writeReports(campaign, function (success) {
            // I hope it finished without errors :)
            var campaignEvent = "attester.campaign.finished";
            if (!success) {
                campaignEvent = "attester.campaign.failed";
                errorsSoFar += 1;
            }
            attester.event.emit(campaignEvent, campaign);

            if (config["shutdown-on-campaign-end"]) {
                campaign.dispose();
            }

            if (createdCampaigns.length === 0) {
                attester.event.emit(errorsSoFar === 0 ? "attester.core.idle" : "attester.core.fail");
            }
        });
    }
}

function markFinished(campaign) {
    for (var i = 0; i < createdCampaigns.length; i += 1) {
        if (createdCampaigns[i] === campaign) {
            createdCampaigns.splice(i, 1);
            return true;
        }
    }
    // If it gets here it didn't find the campaign, I believe it's impossible
    logger.logError("Unable to mark campaign %s as finished", [campaign.id]);
}


core.__reset__ = function () {
    attester.event.offAny(logAnyEvent);
    attester.event.off("*.error", gotAnError);
    attester.event.off("campaign.create", newCampaign);
    errorsSoFar = 0;
    coreStarted = false;
    for (var i = 0; i < createdCampaigns.length; i += 1) {
        createdCampaigns[i].dispose();
    }
    createdCampaigns = [];

    attester.logger.logDebug("__reset__ core done");
    return Q();
};
