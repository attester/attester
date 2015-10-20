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

describe('Resources', function () {
    var Resources = require('../../lib/middlewares/resources.js');
    var path = require('path');
    var resourcesInstance = null;

    var itShouldSelectCorrectly = function (request, expectedPath, expectedContext) {
        it('should select the right file for ' + request, function (done) {
            resourcesInstance.resolvePath(request, function (res) {
                expect(res.path).toEqual(request);
                expect(res.absolutePath).toEqual(expectedPath);
                expect(path.join(res.contextRoot, res.pathInContext)).toEqual(expectedPath);
                expect(res.context).toEqual(expectedContext);
                expect(res.context + res.pathInContext).toEqual(request);
                done();
            });
        });
    };

    beforeEach(function () {
        resourcesInstance = new Resources({
            baseDirectory: __dirname,
            contexts: {
                '/': ['root1', 'root2'],
                '/subFolder': ['subFolder3']
            }
        });
    });

    it('should detect non-existent files', function (done) {
        resourcesInstance.resolvePath('/doesntExist.txt', function (res) {
            expect(res).toBeNull();
            done();
        });
    });

    it('should detect non-existent files in sub contexts', function (done) {
        resourcesInstance.resolvePath('/subFolder/doesntExist.txt', function (res) {
            expect(res).toBeNull();
            done();
        });
    });

    itShouldSelectCorrectly("/1.txt", path.join(__dirname, '/root1/1.txt'), '/');
    itShouldSelectCorrectly("/2.txt", path.join(__dirname, '/root2/2.txt'), '/');
    itShouldSelectCorrectly("/12.txt", path.join(__dirname, '/root1/12.txt'), '/');
    itShouldSelectCorrectly("/subFolder/1.txt", path.join(__dirname, '/root1/subFolder/1.txt'), '/');
    itShouldSelectCorrectly("/subFolder/2.txt", path.join(__dirname, '/root2/subFolder/2.txt'), '/');
    itShouldSelectCorrectly("/subFolder/12.txt", path.join(__dirname, '/root1/subFolder/12.txt'), '/');
    itShouldSelectCorrectly("/subFolder/3.txt", path.join(__dirname, '/subFolder3/3.txt'), '/subFolder/');
    itShouldSelectCorrectly("/subFolder/13.txt", path.join(__dirname, '/subFolder3/13.txt'), '/subFolder/');
    itShouldSelectCorrectly("/subFolder/23.txt", path.join(__dirname, '/subFolder3/23.txt'), '/subFolder/');
});
