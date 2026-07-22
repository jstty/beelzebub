import { expectBufferEquals, type TestFn } from '../../util/common.js';

const tests: TestFn[] = [
  (app) =>
    expectBufferEquals(app, ['MyTasks task1', 'MyTasks task2', 'MyTasks2 task1', 'MyTasks2 task2'])
];
export default tests;
