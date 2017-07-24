var common  = require('../../util/common.js');
var expect  = common.expect;

module.exports = [
  function (app) {
    var dump = app.tasks.helpLogger.getBuffer();
    // console.info('logger dump:', dump);

    var expectList = [
      '┌────────────────────────────────────────────────────────────────────────────────┐\n│ Help Docs                                                                      │\n└────────────────────────────────────────────────────────────────────────────────┘',
      '┌────────────────────────────────────────────────────────────────────────────────┐\n│ MyTasks                                                                        │\n└────────────────────────────────────────────────────────────────────────────────┘',
      'task1',
      '\t ES7 Decorator Example MyTasks - Task 1 \n',
      'task2',
      '\t ES7 Decorator Example MyTasks - Task 2 \n',
      '┌────────────────────────────────────────────────────────────────────────────────┐\n│ MyTasks2                                                                       │\n└────────────────────────────────────────────────────────────────────────────────┘',
      'task1',
      '\t ES7 Decorator Example MyTasks2 - Task 1 \n',
      'task2',
      '\t ES7 Decorator Example MyTasks2 - Task 2 \n'
    ];

    expect(dump.length).is.equal(expectList.length);
    for (var i = 0; i < dump.length; i++) {
      expect(dump[i]).is.equal(expectList[i]);
    }
  }
];
