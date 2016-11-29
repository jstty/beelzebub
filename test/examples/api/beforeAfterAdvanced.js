var common  = require('../../util/common.js');
var expect  = common.expect;

module.exports = [
  function (app) {
    expect(app).to.not.be.null;

    var dump = app.tasks.logger.getBuffer();
    // console.info('logger dump:', dump);

    var expectList = [
      'MyTasks init',
      'MyBaseTasks init',
      'MySubBaseTasks1 init',
      'MySubBaseTasks2 init',
      'MyTasks beforeAll',
      'MyBaseTasks beforeAll',
      'MySubBaseTasks1 beforeAll',
      'MySubBaseTasks1 beforeEach - taskA1',
      'MySubBaseTasks1 taskA1',
      'MySubBaseTasks1 afterEach - taskA1',
      'MyTasks beforeEach - task1',
      'MyTasks task1',
      'MyBaseTasks beforeEach - taskA {"hello":"world"}',
      'MyBaseTasks taskA - world',
      'MyBaseTasks afterEach - taskA {"hello":"world"}',
      'MyBaseTasks beforeEach - taskB {}',
      'MyBaseTasks taskB',
      'MyBaseTasks afterEach - taskB {}',
      'MySubBaseTasks2 beforeAll',
      'MySubBaseTasks2 beforeEach - taskA2',
      'MySubBaseTasks2 taskA2',
      'MySubBaseTasks2 afterEach - taskA2',
      'MyTasks afterEach - task1',
      'MyTasks beforeEach - task2',
      'MyTasks task2',
      'MyTasks afterEach - task2',
      'MySubBaseTasks1 afterAll',
      'MySubBaseTasks2 afterAll',
      'MyBaseTasks afterAll',
      'MyTasks afterAll'
    ];

    expect(dump.length).is.equal(expectList.length);
    for (var i = 0; i < dump.length; i++) {
      expect(dump[i]).is.equal(expectList[i]);
    }
  }
];
