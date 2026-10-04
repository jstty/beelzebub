import { expectBufferEquals, type TestFn } from '../../util/common.js';

const tests: TestFn[] = [
  (app) =>
    expectBufferEquals(app, [
      'MyTasks init',
      'MySubBaseTasks1 init',
      'MySubBaseTasks2 init',
      'MySubSubBaseTasks1 init',
      'MySubSubBaseTasks2 init',
      'MySubSubBaseTasks1 init',
      'MySubSubBaseTasks2 init',
      'MyTasks task1',
      'MySubBaseTasks1 default',
      'MySubSubBaseTasks1 task1 - 123',
      'MySubSubBaseTasks2 task1 - 456',
      'MySubBaseTasks2 default',
      'MySubSubBaseTasks1 task1 - 246',
      'MySubSubBaseTasks2 task1 - 912'
    ])
];
export default tests;
