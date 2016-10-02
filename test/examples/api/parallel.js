var common  = require('../../util/common.js');
var expect  = common.expect;

module.exports = [
  function (app) {
    expect(app).to.not.be.null;

    var dump = app.tasks.logger.getBuffer();
    // console.info('dynamic_simple logger dump:', dump);

    var expectList = [
      'MyTasks task1',
      'MyTasks task3',
      'MyTasks task5',
      'MyTasks task2',
      'MyTasks task4',
      'MyTasks task6'
    ];

    expect(dump.length).is.equal(expectList.length);
    for (var i = 0; i < dump.length; i++) {
      expect(dump[i]).is.equal(expectList[i]);
    }
  }
];
