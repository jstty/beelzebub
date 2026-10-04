import { expectBufferEquals, type TestFn } from '../../util/common.js';

const tests: TestFn[] = [
  (app) =>
    expectBufferEquals(app, [
      'MyTasks task1: before',
      'MyTasks task1: promise delay 500',
      'MyTasks task1: after',
      'MyTasks task2: before',
      'MyTasks task2: yield delay 700',
      'MyTasks task2: after',
      'MyTasks task1: before',
      'MyTasks task2: before',
      'MyTasks task1: promise delay 500',
      'MyTasks task1: after',
      'MyTasks task2: yield delay 700',
      'MyTasks task2: after'
    ])
];
export default tests;
