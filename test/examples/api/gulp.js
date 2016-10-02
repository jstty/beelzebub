var common  = require('../../util/common.js');
var expect  = common.expect;

module.exports = [
  function (app) {
    expect(app).to.not.be.null;

    var dump = app.tasks.logger.getBuffer();
    // console.info('gulp logger dump:', dump);

    var expectList = [
      'MyTasks - Number of Dest Files: 1',
      'MyTasks - Coping Files',
      'MyTasks - Number of Dest Files: 3',
      'MyTasks - Delete Files',
      'MyTasks - Number of Dest Files: 1'
    ];

    expect(dump.length).is.equal(expectList.length);
    for (var i = 0; i < dump.length; i++) {
      expect(dump[i]).is.equal(expectList[i]);
    }
  }
];
