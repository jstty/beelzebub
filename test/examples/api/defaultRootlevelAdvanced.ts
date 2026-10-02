import { expectBufferEquals, type TestFn } from '../../util/common.js';

const tests: TestFn[] = [
  (app) =>
    expectBufferEquals(app, [
      'MyRootLevel task1',
      'MyRootLevel task2',
      'MyTasks1 default',
      'MyTasks1 default',
      'MyTasks2 myDefault',
      'MyTasks2 myDefault'
    ])
];
export default tests;
