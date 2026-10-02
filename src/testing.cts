// CommonJS compatibility boundary for testing utilities.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const api = require('./testing.js') as typeof import('./testing.js');

export = api;
