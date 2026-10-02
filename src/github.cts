// CommonJS compatibility boundary for the GitHub Actions adapter.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const api = require('./github.js') as typeof import('./github.js');

export = api;
