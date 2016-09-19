var common  = require('../../util/common.js');
var expect  = common.expect;

module.exports = [
  function (app) {
    expect(app).to.not.be.null;

    var dump = app.tasks.logger.getBuffer();
    // console.info('dynamic_simple logger dump:', dump);

    var expectList = [
      'MyTasks init',
      'MyBaseTasks init',
      'MyBaseTasks init',
      'MyTasks task1',
      'MyBaseTasks task1 - 123',
      'MyBaseTasks task1 - 456'
    ];

    for (var i = 0; i < dump.length; i++) {
      expect(dump[i]).is.equal(expectList[i]);
    }
  }
];
