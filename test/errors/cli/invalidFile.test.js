var common  = require('../../util/common.js');
var expect  = common.expect;

module.exports = [
  function (app) {
    expect(app).to.not.be.null;

    var dump = app.tasks.logger.getBuffer();
    console.info('logger dump:', dump);

    var expectList = [
    ];

    // expect(dump.length).is.equal(expectList.length);
    // for (var i = 0; i < dump.length; i++) {
    //   expect(dump[i]).is.equal(expectList[i]);
    // }
  }
];
