import { expectBufferEquals, type TestFn } from '../../util/common.js';

const tests: TestFn[] = [
  (app) => expectBufferEquals(app, ['MyTasks1 default hello 1', 'MyTasks1 task hello 2'])
];
export default tests;
