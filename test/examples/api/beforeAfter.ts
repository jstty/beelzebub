import { expectBufferEquals, type TestFn } from '../../util/common.js';

const tests: TestFn[] = [
  (app) =>
    expectBufferEquals(app, [
      'MyTasks beforeAll',
      'MyTasks beforeEach - task1',
      'MyTasks task1',
      'MyTasks afterEach - task1',
      'MyTasks beforeEach - task2',
      'MyTasks task2',
      'MyTasks afterEach - task2',
      'MyTasks afterAll'
    ])
];
export default tests;
