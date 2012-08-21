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

describe('FileSet', function () {
    var FileSet = require('../../lib/fileset.js');
    var pathUtils = require('path');
    var testIndex = 0;
    var testRoot = pathUtils.join(__dirname, 'root');

    var itShouldList = function (config, expectedFiles) {
        testIndex++;
        it('should list correct files for test ' + testIndex, function (done) {
            if (config.rootDirectory == null) {
                config.rootDirectory = testRoot;
            }
            var fileSet = new FileSet(config);
            fileSet.list(function (res) {
                var l = expectedFiles.length;
                expect(res.length).toEqual(l);
                for (var i = 0; i < l; i++) {
                    expect(res).toContain(expectedFiles[i]);
                }
                done();
            });
        });
    };

    itShouldList({}, []);
    itShouldList({
        includes : ['*']
    }, []);
    itShouldList({
        includes : ['**/a.txt']
    }, ['a/b/c/a.txt', 'a/a.txt']);
    itShouldList({
        includes : ['**/a.txt']
    }, ['a/b/c/a.txt', 'a/a.txt']);
    itShouldList({
        includes : ['**/a.txt', '**/b.txt']
    }, ['a/b/c/a.txt', 'a/a.txt', 'b/b.txt']);
    itShouldList({
        includes : ['**/*.txt'],
        excludes : ['**/a.txt', '**/b.txt']
    }, []);
    itShouldList({
        includes : ['a/b/**']
    }, ['a/b/c/a.txt']);
});
