var common  = require('../../util/common.js');
var expect  = common.expect;

module.exports = [
  function (app, out) {
    expect(out).is.equal("MyTasks task1\nMyTasks task2\n");
  }
];
