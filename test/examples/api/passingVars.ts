import { expectBufferEquals, type TestFn } from '../../util/common.js';

const tests: TestFn[] = [
  (app) =>
    expectBufferEquals(app, [
      'MyTasks task1 - hello 1',
      'MyTasks task2 - world 2',
      'MyTasks task3 - test 3'
    ])
];
export default tests;
