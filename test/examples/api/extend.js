var common  = require('../../util/common.js');
var expect  = common.expect;

module.exports = [
  function (app) {
    expect(app).to.not.be.null;

    var dump = app.tasks.logger.getBuffer();
        // console.info('extend logger dump:', dump);

    var expectList = [
      'MyTasks task1',
      'MyTasks task3',
      'MyBaseTasks task2'
    ];

    for (var i = 0; i < dump.length; i++) {
      expect(dump[i]).is.equal(expectList[i]);
    }
  }
];
