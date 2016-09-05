var common  = require('../../util/common.js');
var expect  = common.expect;

module.exports = [
  function (app) {
    expect(app).to.not.be.null;

    var dump = app.tasks.logger.getBuffer();
    // console.info('dynamic_extended logger dump:', dump);

    var expectList = [
      'MyTasks init',
      'MySubBaseTasks1 init',
      'MySubBaseTasks2 init',
      'MySubSubBaseTasks1 init',
      'MySubSubBaseTasks2 init',
      'MySubSubBaseTasks1 init',
      'MySubSubBaseTasks2 init',
      'MySubSubBaseTasks task1 - 789'
    ];

    for (var i = 0; i < dump.length; i++) {
      expect(dump[i]).is.equal(expectList[i]);
    }
  }
];
