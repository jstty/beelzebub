import { expectBufferEquals, type TestFn } from '../../util/common.js';

const tests: TestFn[] = [
  (app) =>
    expectBufferEquals(app, [
      'MyTasks beforeAll - task1 hello',
      'MyTasks task1 - hello true',
      'MyTasks task2 - 100 true',
      'MyTasks task3 - "hello world" te,st'
    ])
];
export default tests;
