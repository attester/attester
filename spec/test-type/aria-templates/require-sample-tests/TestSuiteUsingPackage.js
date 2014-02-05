var Aria = require("ariatemplates/Aria");
var ariaJsunitTestSuite = require("ariatemplates/jsunit/TestSuite");
module.exports = Aria.classDefinition({
    $classpath : 'test.myCompany.MyTestSuite',
    $extends : ariaJsunitTestSuite,
    $constructor : function () {
        this.$TestSuite.constructor.call(this);
        this.addTests(this.$package + '.MyTest1');
        this.addTests(this.$package + '.MyTest2');
        this.addTests(this.$package + '.MyTest3');
    }
});
