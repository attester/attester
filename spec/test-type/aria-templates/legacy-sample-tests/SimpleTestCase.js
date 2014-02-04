Aria.classDefinition({
    $classpath : 'test.myCompany.MyTestCase',
    $extends : 'aria.jsunit.TestCase',
    $constructor : function () {
        this.$TestCase.constructor.call(this);
    },
    $prototype : {
        testOne : function () {

        },

        testAsyncTwo : function () {

        }
    }
});
