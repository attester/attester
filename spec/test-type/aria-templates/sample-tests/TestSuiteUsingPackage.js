Aria.classDefinition({
    $classpath : 'test.myCompany.MyTestSuite',
    $extends : 'aria.jsunit.TestSuite',
    $constructor : function () {
        this.$TestSuite.constructor.call(this);
        this.addTests(this.$package + '.MyTest1');
        this.addTests(this.$package + '.MyTest2');
        this.addTests(this.$package + '.MyTest3');
    }
});
