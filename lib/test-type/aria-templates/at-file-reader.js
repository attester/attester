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

var vm = require('vm');
var UglifyJS = require("uglify-js");
var findRequires = require('noder-js/findRequires');
var oldSyntaxRegexp = /Aria\s*\.\s*(class|interface|bean|tplScript)Definition(s?)\s*\(/;

/**
 * Reads the content of a test which uses the old Aria Templates syntax (without require), and fills res with the following properties: <ul>
 * <li>classpath (string) classpath</li>
 * <li>testSuite (boolean) whether the class is a test suite</li>
 * <li>subTests (array of strings) in case testSuite is true, classpaths of the tests which are part of the suite</li>
 * <li>error (object with message, args and object properties) in case there is an error</li>
 * </ul>
 * @param {Object} res object receiving the results
 * @param {String} fileContent file content
 * @param {String} fileName file name
 */

function readATOldFileContent(res, fileContent, fileName) {
    var classDef = null;
    var classDefinitionCalls = 0;
    var sandbox = {
        aria: {
            core: {
                Browser: {}
            }
        },
        Aria: {
            classDefinition: function (def) {
                classDefinitionCalls++;
                classDef = def || {};
            }
        }
    };
    vm.runInNewContext(fileContent, sandbox, fileName);
    if (classDefinitionCalls != 1) {
        res.error = {
            message: "In %s: there is not exactly one call to Aria.classDefinition.",
            args: [fileName]
        };
        return;
    }
    res.classpath = classDef.$classpath;
    if (typeof res.classpath != "string") {
        res.error = {
            message: "In %s: missing classpath in Aria.classDefinition.",
            args: [fileName]
        };
        return;
    }
    res.testSuite = (classDef.$extends == 'aria.jsunit.TestSuite');
    if (res.testSuite) {
        readTestSuite(res, classDef.$constructor);
    }
}

/**
 * Executes the given test suite constructor in an appropriate environment, and fills res with the subTests property.
 * @param {Object} res object receiving the results
 * @param {Function} constructor test suite constructor
 */

function readTestSuite(res, constructor) {
    var classpath = res.classpath;
    var lastDot = classpath.lastIndexOf('.');
    var testSuiteObject = {
        $TestSuite: {
            constructor: function () {},
            $constructor: function () {}
        },
        $classpath: classpath,
        $package: classpath.substring(0, lastDot),
        $class: classpath.substring(lastDot + 1),
        _tests: [],
        addTests: function () {
            var args = arguments;
            for (var i = 0, l = args.length; i < l; i++) {
                var testClassPath = args[i];
                if (typeof testClassPath == "string") {
                    this._tests.push(testClassPath);
                }
            }
        }
    };
    constructor.call(testSuiteObject);
    res.subTests = testSuiteObject._tests.slice(0);
}

/**
 * Reads the content of a test which uses the new Aria Templates syntax (with require), and fills res with the following properties: <ul>
 * <li>classpath (string) classpath</li>
 * <li>testSuite (boolean) whether the class is a test suite</li>
 * <li>subTests (array of strings) in case testSuite is true, classpaths of the tests which are part of the suite</li>
 * <li>error (object with message, args and object properties) in case there is an error</li>
 * </ul>
 * This method reads the file by parsing it with Uglify-JS and recognising the calls to Aria.classDefinition.
 * @param {Object} res object receiving the results
 * @param {String} fileContent file content
 * @param {String} fileName file name
 */

function readATNewFileContent(res, fileContent, fileName) {
    var foundClassDef = null;
    var walker = new UglifyJS.TreeWalker(function (node) {
        var isAssignment = node instanceof UglifyJS.AST_Assign && node.operator == "=";
        if (!isAssignment) return;
        var moduleExports = node.left;
        var isDotExports = moduleExports instanceof UglifyJS.AST_Dot && moduleExports.property == "exports";
        if (!isDotExports) return;
        var moduleVar = moduleExports.expression;
        var isModuleDotExports = moduleVar instanceof UglifyJS.AST_SymbolRef && moduleVar.name == "module" && moduleVar.thedef.undeclared;
        if (!isModuleDotExports) return;
        var callAriaClassDefinition = node.right;
        var isFnCallWithParam = callAriaClassDefinition instanceof UglifyJS.AST_Call && callAriaClassDefinition.args.length >= 1;
        if (!isFnCallWithParam) return;
        var ariaClassDefinition = callAriaClassDefinition.expression;
        var isDotClassDefinition = ariaClassDefinition instanceof UglifyJS.AST_Dot && ariaClassDefinition.property == "classDefinition";
        if (!isDotClassDefinition) return;
        var ariaRef = readRequire(ariaClassDefinition.expression);
        if (!(ariaRef && /^aria(templates)?\/Aria(\.js)?$/.test(ariaRef))) return;
        var classDefArg = callAriaClassDefinition.args[0];
        var isObjectLitteral = classDefArg instanceof UglifyJS.AST_Object;
        if (!isObjectLitteral) return;
        if (foundClassDef) {
            res.error = {
                message: "Found several 'module.exports = Aria.classDefinition({...});' in %s: lines %s and %s.",
                args: [fileName, foundClassDef.start.line, classDefArg.start.line]
            };
            return;
        }
        foundClassDef = classDefArg;
        return true;
    });
    var ast = UglifyJS.parse(fileContent, {
        filename: fileName
    });
    ast.figure_out_scope();
    ast.walk(walker);
    if (res.error) return;
    if (!foundClassDef) {
        res.error = {
            message: "Could not find 'var Aria = require(\"ariatemplates/Aria\"); module.exports = Aria.classDefinition({...});' in %s.",
            args: [fileName]
        };
        return;
    }
    var constructor = null;
    var parentClass = null;
    foundClassDef.properties.forEach(function (property) {
        if (property.key == "$classpath" && property.value instanceof UglifyJS.AST_String) {
            res.classpath = property.value.value;
        } else if (property.key == "$extends") {
            parentClass = readRequire(property.value);
        } else if (property.key == "$constructor" && property.value instanceof UglifyJS.AST_Function) {
            constructor = property.value;
        }
    });
    if (typeof res.classpath != "string") {
        res.error = {
            message: "In %s: missing classpath in Aria.classDefinition.",
            args: [fileName]
        };
        return res;
    }
    res.testSuite = parentClass && /^aria(templates)?\/jsunit\/TestSuite(\.js)?$/.test(parentClass);
    if (res.testSuite && constructor) {
        var sandbox = {};
        vm.runInNewContext("$constructor=" + constructor.print_to_string(), sandbox, fileName);
        readTestSuite(res, sandbox.$constructor);
    }
}

/**
 * Returns the dependency the given expression refers to, using the following algorithm:
 * If the given expression contains a call to require with a single string parameter, this method returns that string.
 * Otherwise, if the given expression contains a reference to a variable, this method reads the initial definition of that variable
 * and calls itself recursively with that definition.
 * For example, considering the following code:
 * <code>
 * var a = require("myDependency");
 * var b = a;
 * var c = b;
 * c.classDefinition({...});
 * </code>
 * When called with the expression "c" from the last line, this method returns "myDependency" (as it goes from "c" to "b", then from "b" to "a"
 * and detects that "a" contains a reference to "myDependency").
 * In practise, this method allows to cover the following two main use cases:
 * <code>
 * module.exports = require("ariatemplates/Aria").classDefinition({...}); // inline usage of require
 * </code>
 * and
 * <code>
 * var Aria = require("ariatemplates/Aria"); // definition of the Aria variable
 * module.exports = Aria.classDefinition({...}); // using the previously defined variable
 * </code>
 * @param {UglifyJS.AST_Node} expression (node of the abstract syntax tree provided by UglifyJS)
 * @return {String|null} the dependency the expression is refering to, or null if the variable is not refering to a dependency loaded with
 * require (or if it was not possible to detect it with this simple algorithm)
 */

function readRequire(expression) {
    if (expression instanceof UglifyJS.AST_Call && expression.args.length == 1) {
        var requireVar = expression.expression;
        if (requireVar instanceof UglifyJS.AST_SymbolRef && requireVar.name == "require" && requireVar.thedef.undeclared) {
            var param = expression.args[0];
            if (param instanceof UglifyJS.AST_String) {
                return param.value;
            }
        }
    } else if (expression instanceof UglifyJS.AST_SymbolRef) {
        var def = expression.thedef.init;
        if (def && def.end.endpos < expression.start.pos) {
            return readRequire(def);
        }
    }
    return null;
}

/**
 * Reads the content of a test which uses either the new or the old Aria Templates syntax (with or without require),
 * and fills res with the following properties: <ul>
 * <li>classpath (string) classpath</li>
 * <li>testSuite (boolean) whether the class is a test suite</li>
 * <li>subTests (array of strings) in case testSuite is true, classpaths of the tests which are part of the suite</li>
 * <li>error (object with message, args and object properties) in case there is an error</li>
 * </ul>
 * The detection algorithm of the old or the new syntax is done in the same way as it is done in Aria Templates: the
 * file is considered to be using the old syntax if there is no require and there is a call to Aria.xDefinition. Otherwise,
 * it is using the new syntax (with require).
 * @param {Object} res object receiving the results
 * @param {String} fileContent file content
 * @param {String} fileName file name
 */

function readATFileContent(fileContent, fileName) {
    var res = {};
    try {
        var requires = findRequires(fileContent);
        var oldSyntax = !requires.length && oldSyntaxRegexp.test(fileContent);
        if (oldSyntax) {
            readATOldFileContent(res, fileContent, fileName);
        } else {
            readATNewFileContent(res, fileContent, fileName);
        }
    } catch (e) {
        res.error = {
            message: "An exception occurred in %s: %s",
            args: [fileName, e + ""],
            object: e
        };
    }
    return res;
}

module.exports = readATFileContent;