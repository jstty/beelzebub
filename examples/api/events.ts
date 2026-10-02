// !-- FOR TESTS
import { pathToFileURL } from 'node:url';
import bz_factory, { type BeelzebubConfig } from '../../src/index.js';

export default async function wrapper(options?: BeelzebubConfig) {
  bz_factory.delete();
  // --!

  // =====================================================
  // <EXAMPLE>
  const bz = bz_factory(options ?? { verbose: true });

  class MyTasks extends bz.Tasks {
    task1() {
      this.logger.log('MyTasks task1');
      this.$emit('customEvent', { hello: 'world1' });
    }

    task2() {
      this.logger.log('MyTasks task2');
      this.$emit('customEvent', { hello: 'world2' });
    }

    _internalFunction() {
      this.logger.error('this should be ignored');
    }
  }

  bz.on('$before', 'MyTasks.task1', function (this: any, taskInfo: any, data: any) {
    this.logger.log('$before event task:', taskInfo, ', data:', data);
  });

  bz.on('$after', 'MyTasks.task1', function (this: any, taskInfo: any, data: any) {
    this.logger.log('$after event task:', taskInfo, ', data:', data);
  });

  bz.on({
    name: 'customEvent',
    task: 'MyTasks.task1',
    callback(this: any, taskInfo: any, data: any) {
      this.logger.log('customEvent event task:', taskInfo, ', data:', data);
    }
  });

  bz.on('$before', function (this: any, taskInfo: any, data: any) {
    this.logger.log('$before ALL event task:', taskInfo, ', data:', data);
  });

  bz.on('$after', function (this: any, taskInfo: any, data: any) {
    this.logger.log('$after ALL event task:', taskInfo, ', data:', data);
  });

  bz.on('customEvent', function (this: any, taskInfo: any, data: any) {
    this.logger.log('customEvent ALL event task:', taskInfo, ', data:', data);
  });

  bz.add(MyTasks);

  await bz.run(
    {
      task: 'MyTasks.task1',
      vars: { hello: 'vars' }
    },
    'MyTasks.task2'
  );
  /* Output:
$before event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data:
$before ALL event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data:
MyTasks task1
customEvent event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data: {"hello":"world1"}
customEvent ALL event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data: {"hello":"world1"}
$after event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data:
$after ALL event task: {"task":"MyTasks.task1","vars":{"hello":"vars"}} , data:
$before ALL event task: {"task":"MyTasks.task2","vars":{}} , data:
MyTasks task2
customEvent ALL event task: {"task":"MyTasks.task2","vars":{}} , data: {"hello":"world2"}
$after ALL event task: {"task":"MyTasks.task2","vars":{}} , data:
*/
  // </EXAMPLE>
  // =====================================================

  // !-- FOR TESTS
  return bz;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void wrapper();
}
// --!
