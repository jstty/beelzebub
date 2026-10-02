import { expectBufferEquals, type TestFn } from '../../util/common.js';

const tests: TestFn[] = [
  (app) =>
    expectBufferEquals(app, [
      'MyTasks task1',
      'MyTasks task3',
      'MyBaseTasks task2',
      'MyBaseTasks task2 option'
    ])
];
export default tests;
