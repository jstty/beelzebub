import { expectBufferEquals, type TestFn } from '../../util/common.js';

const tests: TestFn[] = [
  (app) =>
    expectBufferEquals(app, [
      'MyTasks task1',
      'MyTasks task3',
      'MyTasks task5',
      'MyTasks task6',
      'MyTasks task4',
      'MyTasks task2'
    ])
];
export default tests;
