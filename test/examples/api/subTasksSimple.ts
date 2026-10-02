import { expectBufferEquals, type TestFn } from '../../util/common.js';

const tests: TestFn[] = [
  (app) =>
    expectBufferEquals(app, [
      'MyTasks init',
      'MyBaseTasks init',
      'MyBaseTasks init',
      'MyTasks task1',
      'MyBaseTasks task1 - 123',
      'MyBaseTasks task1 - 456'
    ])
];
export default tests;
