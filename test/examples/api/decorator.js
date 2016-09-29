var common  = require('../../util/common.js');
var expect  = common.expect;

module.exports = [
  function (app) {
    expect(app).to.not.be.null;

    var dump = app.tasks.logger.getBuffer();
    // console.info('async logger dump:', dump);

    var expectList = [
      'MyTasks task1',
      'MyTasks task2',
      'MyTasks2 task1',
      'MyTasks2 task2'
    ];

    for (var i = 0; i < dump.length; i++) {
      expect(dump[i]).is.equal(expectList[i]);
    }
  }
];
