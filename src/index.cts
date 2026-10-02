/**
 * CommonJS compatibility entry point.
 *
 * Node.js 24 can synchronously require the ESM implementation. Re-exporting
 * its callable default this way preserves the v1 `require('beelzebub')` shape
 * while also exposing every named v2 export as a property.
 */
// This file is the deliberate CommonJS boundary for the package.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const api = require('./index.js') as typeof import('./index.js');
const factory = Object.assign(api.default, api, { default: api.default });

export = factory;
