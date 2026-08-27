import { expectBufferEquals, type TestFn } from '../../util/common.js';

const tests: TestFn[] = [(app) => expectBufferEquals(app, ['MyRootLevel myDefault'])];
export default tests;
