import { expectBufferEquals, type TestFn } from '../../util/common.js';

const tests: TestFn[] = [(app) => expectBufferEquals(app, ['MyTasks task1', 'MyTasks task2'])];
export default tests;
