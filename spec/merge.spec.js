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

describe('merge', function () {
    merge = require('../lib/merge.js');
    it('should merge objects correctly', function () {
        var a = {
            a: 1,
            c: {
                e: 1,
                d: 1
            },
            k: ['a', 'b']
        };
        var b = {
            b: 1,
            c: {
                f: 1,
                g: 1
            },
            k: ['e', 'f'],
            l: {
                m: 1,
                n: 1
            }
        };
        merge(a, b);
        expect(a).toEqual({
            a: 1,
            b: 1,
            c: {
                e: 1,
                d: 1,
                f: 1,
                g: 1
            },
            k: ['a', 'b', 'e', 'f'],
            l: {
                m: 1,
                n: 1
            }
        });
    });
});