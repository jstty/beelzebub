'use strict';
// !-- FOR TESTS
let wrapper = function (options) {
// --!

// =====================================================
  const fs = require('fs');
  let Beelzebub = require('../../');
  let bz = Beelzebub(options || { verbose: true });

  class MyTasks extends Beelzebub.Tasks {
    constructor (config) {
      super(config);
      this.$setName('MyTasks');
    }

    task1 () {
      var data = '';

      var stream = fs.createReadStream('./static-files/src/file1.txt');

      stream.setEncoding('utf8');

      stream.on('data', (chunk) => {
        data += chunk;
      });

      stream.on('end', () => {
        this.logger.log('MyTasks task1 data size:', data.length);
            // this.logger.log('MyTasks task1 data:', data);
      });

      return stream;
    }

    task2 () {
      this.logger.log('MyTasks task2');
    }
  }

  bz.add(MyTasks);

  let p = bz.run('MyTasks.task1', 'MyTasks.task2');
/* Output:
MyTasks task1 data size: 840
MyTasks task2
*/
// =====================================================

// !-- FOR TESTS
  return p.then(() => { return bz; });
};
module.exports = wrapper;
// if not running in test, then run wrapper
if (typeof global.it !== 'function') wrapper();
// --!
