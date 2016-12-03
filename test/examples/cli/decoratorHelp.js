var common  = require('../../util/common.js');
var expect  = common.expect;

module.exports = [
  function (app) {
    var dump = app.tasks.helpLogger.getBuffer();
    // console.info('logger dump:', dump);

    var expectList = [
      '\u001b[90m┌────────────────────────────────────────────────────────────────────────────────┐\u001b[39m\n\u001b[90m│\u001b[39m Help Docs                                                                      \u001b[90m│\u001b[39m\n\u001b[90m└────────────────────────────────────────────────────────────────────────────────┘\u001b[39m',
      '\u001b[90m┌────────────────────────────────────────────────────────────────────────────────┐\u001b[39m\n\u001b[90m│\u001b[39m MyTasks                                                                        \u001b[90m│\u001b[39m\n\u001b[90m└────────────────────────────────────────────────────────────────────────────────┘\u001b[39m',
      '\u001b[1m\u001b[4mtask1\u001b[24m\u001b[22m',
      '\t ES7 Decorator Example MyTasks - Task 1 \n',
      '\u001b[1m\u001b[4mtask2\u001b[24m\u001b[22m',
      '\t ES7 Decorator Example MyTasks - Task 2 \n',
      '\u001b[90m┌────────────────────────────────────────────────────────────────────────────────┐\u001b[39m\n\u001b[90m│\u001b[39m MyTasks2                                                                       \u001b[90m│\u001b[39m\n\u001b[90m└────────────────────────────────────────────────────────────────────────────────┘\u001b[39m',
      '\u001b[1m\u001b[4mtask1\u001b[24m\u001b[22m',
      '\t ES7 Decorator Example MyTasks2 - Task 1 \n',
      '\u001b[1m\u001b[4mtask2\u001b[24m\u001b[22m',
      '\t ES7 Decorator Example MyTasks2 - Task 2 \n'
    ];

    expect(dump.length).is.equal(expectList.length);
    for (var i = 0; i < dump.length; i++) {
      expect(dump[i]).is.equal(expectList[i]);
    }
  }
];
