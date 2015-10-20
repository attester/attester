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

module.exports = function (grunt) {
    grunt.initConfig({
        jshint: {
            lib: ['package.json', 'gruntfile.js', 'lib/**/*.js', '!lib/**/html5shiv.js'],
            options: grunt.file.readJSON('.jshintrc'),
            specs: {
                options: grunt.file.readJSON('.jshintrc-specs'), // merged on top of default config
                files: {
                    src: ['spec/**/*.spec.js']
                }
            }
        },
        watch: {
            files: ['<%= jshint.lib %>', '<%= jshint.specs.files.src %>'],
            tasks: ['dev']
        },
        jsbeautifier: {
            options: {
                js: {
                    space_after_anon_function: true
                }
            },
            update: {
                src: ['<%= jshint.lib %>', '<%= jshint.specs.files.src %>']
            },
            check: {
                src: ['<%= jshint.lib %>', '<%= jshint.specs.files.src %>'],
                options: {
                    mode: "VERIFY_ONLY"
                }
            }
        }
    });

    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-jsbeautifier");
    grunt.registerTask("test", ["jsbeautifier:check", "jshint"]);
    grunt.registerTask("dev", ["beautify", "jshint"]);
    grunt.registerTask("beautify", ["jsbeautifier:update"]);
    grunt.registerTask("default", ["test"]);

};
