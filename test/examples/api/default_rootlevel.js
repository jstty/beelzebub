var common  = require('../../util/common.js');
var expect  = common.expect;

module.exports = [
  function (app) {
    expect(app).to.not.be.null;

    var dump = app.tasks.logger.getBuffer();
    // console.info('default_rootlevel logger dump:', dump);

    var expectList = [
      'MyRootLevel myDefault',
      'MyRootLevel task1',
      'MyRootLevel task2',
      'MyTasks myDefault'
    ];

    for (var i = 0; i < dump.length; i++) {
      expect(dump[i]).is.equal(expectList[i]);
    }
  }
];
