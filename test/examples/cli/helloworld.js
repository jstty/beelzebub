var common  = require('../../util/common.js');
var expect  = common.expect;

module.exports = [
  function (app) {
    var dump = app.tasks.logger.getBuffer();
    // console.info('logger dump:', dump);

    var expectList = [
      'MyTasks task1',
      'MyTasks task2'
    ];

    expect(dump.length).is.equal(expectList.length);
    for (var i = 0; i < dump.length; i++) {
      expect(dump[i]).is.equal(expectList[i]);
    }
  }
];
