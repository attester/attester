Aria.classDefinition({
    $classpath : 'test.myCompany.MyTestSuite',
    $extends : 'aria.jsunit.TestSuite',
    $constructor : function () {
        this.$TestSuite.$constructor.call(this);

        this.addTests("test.myCompany.firstModule.FirstModuleTestSuite", "test.myCompany.secondModule.SearchTestCase", "test.myCompany.secondModule.RetrieveTestCase");
    }
});
