var Aria = require("ariatemplates/Aria");
var ariaJsunitTestSuite = require("ariatemplates/jsunit/TestSuite");
module.exports = Aria.classDefinition({
    $classpath : 'test.myCompany.MyTestSuite',
    $extends : ariaJsunitTestSuite,
    $constructor : function () {
        this.$TestSuite.$constructor.call(this);

        this.addTests("test.myCompany.firstModule.FirstModuleTestSuite", "test.myCompany.secondModule.SearchTestCase", "test.myCompany.secondModule.RetrieveTestCase");
    }
});
