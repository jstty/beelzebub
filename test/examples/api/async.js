var common  = require('../../util/common.js');
var expect  = common.expect;

module.exports = [
    function (app) {
        expect(app).to.not.be.null;

        var dump = app.tasks.logger.getBuffer();
        // console.info('async logger dump:', dump);

        var expectList = [
            'MyTasks task1: before',
            'MyTasks task1: promise delay 200',
            'MyTasks task1: after',
            'MyTasks task2: before',
            'MyTasks task2: yield delay 200',
            'MyTasks task2: after',
            'MyTasks task1: before',
            'MyTasks task2: before',
            'MyTasks task1: promise delay 200',
            'MyTasks task2: yield delay 200',
            'MyTasks task1: after',
            'MyTasks task2: after'
        ];

        for(var i = 0; i < dump.length; i++){
            expect( dump[i] ).is.equal(expectList[i]);
        }
    }
];
