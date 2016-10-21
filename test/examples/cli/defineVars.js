var common  = require('../../util/common.js');
var expect  = common.expect;

module.exports = [
  function (app) {
    expect(app).to.not.be.null;

    var dump = app.tasks.logger.getBuffer();
    // console.info('async logger dump:', dump);

    var expectList = [
      'MyTasks task1 - hello true',
      'MyTasks task2 - 100 true',
      'MyTasks task3 - "hello world" te,st',
    ];

    expect(dump.length).is.equal(expectList.length);
    for (var i = 0; i < dump.length; i++) {
      expect(dump[i]).is.equal(expectList[i]);
    }
  }
];
