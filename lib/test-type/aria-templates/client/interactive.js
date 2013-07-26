/* globals aria, Aria, attester */
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

attester.currentTask.start = function () {
    var width = {
        min: 180
    };
    var height = {
        min: 342
    };
    aria.core.DownloadMgr.updateRootMap({
        "MainTestSuite": "./"
    });
    aria.core.DownloadMgr.updateUrlMap({
        "MainTestSuite": "MainTestSuite.js"
    });
    Aria.loadTemplate({
        rootDim: {
            width: width,
            height: height
        },
        classpath: "aria.tester.runner.view.main.Main",
        div: "root",
        width: width,
        height: height,
        moduleCtrl: {
            classpath: "aria.tester.runner.ModuleController"
        }
    });
};