import { expectBufferEquals, type TestFn } from '../../util/common.js';

const tests: TestFn[] = [
  (app) =>
    expectBufferEquals(app, [
      'MyTasks - Number of Dest Files: 1',
      'MyTasks - Coping Files',
      'MyTasks - Number of Dest Files: 3',
      'MyTasks - Delete Files',
      'MyTasks - Number of Dest Files: 1'
    ])
];
export default tests;
