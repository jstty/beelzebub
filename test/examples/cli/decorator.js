var common  = require('../../util/common.js');
var expect  = common.expect;

module.exports = [
  function (app) {
    var dump = app.tasks.logger.getBuffer();
    // console.info('basic logger dump:', dump);

    var expectList = [
      '┌──────────────────────────────────────────────────────────────────────────────┐',
      '│ Help Docs                                                                    │',
      '└──────────────────────────────────────────────────────────────────────────────┘',
      '┌──────────────────────────────────────────────────────────┐',
      '│ MyTasks                                                  │',
      '└──────────────────────────────────────────────────────────┘',
      '\u001b[1m\u001b[4mtask1\u001b[24m\u001b[22m',
      '\t ES7 Decorator Example MyTasks - Task 1 \n',
      '\u001b[1m\u001b[4mtask2\u001b[24m\u001b[22m',
      '\t ES7 Decorator Example MyTasks - Task 2 \n',
      '┌──────────────────────────────────────────────────────────┐',
      '│ MyTasks2                                                 │',
      '└──────────────────────────────────────────────────────────┘',
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
