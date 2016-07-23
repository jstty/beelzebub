var common  = require('../../util/common.js');
var expect  = common.expect;

module.exports = [
    function (app) {
        expect(app).to.not.be.null;

        var dump = app.tasks.logger.getBuffer();
        // console.info('kitcken_sink logger dump:', dump);

        var expectList = [
            'MyBaseTasks task1',
            'MyTasks task1',
            '------------------------------',
            'SuperTasks comboTask',
            'SuperTasks task1: 1',
            'SuperTasks task1: 2',
            '------------------------------',
            'SuperTasks palTask',
            'SuperTasks task1: 1',
            'SuperTasks task2: 1',
            'SuperTasks task1: 2',
            'SuperTasks task2: 2',
            '------------------------------',
            'SuperTasks task2: 1',
            'SuperTasks task2: 2'
        ];

        for(var i = 0; i < dump.length; i++){
            expect( dump[i] ).is.equal(expectList[i]);
        }
    }
];
