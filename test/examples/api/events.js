var common  = require('../../util/common.js');
var expect  = common.expect;

module.exports = [
  function (app) {
    expect(app).to.not.be.null;

    var dump = app.tasks.logger.getBuffer();
    // console.info('logger dump:', dump);

    var expectList = [
      '$before event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data: ',
      '$before ALL event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data: ',
      'MyTasks task1',
      'customEvent event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data: {"hello":"world1"}',
      'customEvent ALL event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data: {"hello":"world1"}',
      '$after event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data: ',
      '$after ALL event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data: ',
      '$before ALL event task: {"task":"MyTasks.task2","vars":{}} , data: ',
      'MyTasks task2',
      'customEvent ALL event task: {"task":"MyTasks.task2","vars":{}} , data: {"hello":"world2"}',
      '$after ALL event task: {"task":"MyTasks.task2","vars":{}} , data: '
    ];

    expect(dump.length).is.equal(expectList.length);
    for (var i = 0; i < dump.length; i++) {
      expect(dump[i]).is.equal(expectList[i]);
    }
  }
];
