var common  = require('../../util/common.js');
var expect  = common.expect;

module.exports = [
  function (app) {
    expect(app).to.not.be.null;

    var dump = app.tasks.logger.getBuffer();
    // console.info('logger dump:', dump);

    var expectList = [
      'MyTasks beforeAll',
      'MyTasks beforeEach - task1',
      'MyTasks task1',
      'MyTasks afterEach - task1',
      'MyTasks beforeEach - task2',
      'MyTasks task2',
      'MyTasks afterEach - task2',
      'MyTasks afterAll'
    ];

    expect(dump.length).is.equal(expectList.length);
    for (var i = 0; i < dump.length; i++) {
      expect(dump[i]).is.equal(expectList[i]);
    }
  }
];
