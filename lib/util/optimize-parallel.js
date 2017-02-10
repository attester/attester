/*
 * Copyright 2012 Amadeus s.a.s.
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
var os = require('os');

/**
 * Calculate the number of PhantomJS instances to be run in parallel, considering max threads and available RAM
 * constraints. Takes as an input the suggested number of instances. This value is then perhaps lowered if there are not
 * enough resources. If the suggested value is "auto" or undefined, then calculates the maximum possible number.
 * @param {Object} cfg {maxInstances: Number|String, memoryPerInstance: Number}
 * @param {Logger} logger
 * @return {Number}
 */
var optimizeNumberOfParallelInstances = function (cfg, logger) {
    if (cfg.maxInstances === 0) { // explicitly asking for no PhantomJS
        logger.logInfo("No PhantomJS instances launched.");
        return 0;
    }

    var initialMaxInstances = cfg.maxInstances;
    if (!initialMaxInstances || initialMaxInstances == "auto") {
        initialMaxInstances = 0;
    }
    initialMaxInstances = parseInt(initialMaxInstances, 10);
    if (isNaN(initialMaxInstances)) {
        logger.logWarn("Expected cfg.maxInstances to be either 'auto' or numeric. Defaulting to 'auto'");
        initialMaxInstances = 0;
    }

    var maxInstances = initialMaxInstances;

    // limit max instances by available CPUs
    var cpus = os.cpus().length;
    if (maxInstances === 0 || maxInstances > cpus) {
        maxInstances = cpus;
    }

    // further limit max instances by available RAM
    var availableRamMB = os.freemem() / 1048576;
    var memPerInstanceMB = parseInt(cfg.memoryPerInstance, 10) || 1;
    var maxInstancesWithinRam = Math.floor(availableRamMB / memPerInstanceMB);
    maxInstances = Math.min(maxInstances, maxInstancesWithinRam);
    
    // guarantee at least one instance is running
    maxInstances = Math.max(maxInstances, 1);

    if (maxInstances < initialMaxInstances) {
        logger.logWarn("Limiting the number of PhantomJS instances from " + initialMaxInstances + " to " + maxInstances);
    } else if (initialMaxInstances === 0) {
        logger.logInfo("Automatic number of PhantomJS instances: " + maxInstances);
    } else {
        logger.logInfo("Number of PhantomJS instances: " + maxInstances);
    }

    return maxInstances;
};

module.exports = optimizeNumberOfParallelInstances;
