import { expectBufferEquals, type TestFn } from '../../util/common.js';

const tests: TestFn[] = [(app) => expectBufferEquals(app, ['MyCustomTasks2 task1'])];
export default tests;
