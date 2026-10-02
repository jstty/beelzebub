import { afterEach, describe, expect, it } from 'vitest';

import bz, { BzTasks, type BeelzebubConfig, type VarDefMap } from '../src/index.js';
import { createTestConfig } from './helpers.js';

afterEach(() => {
  bz.delete();
});

function createVarsTasks(captured: Array<Record<string, unknown>>) {
  return class VarsTasks extends BzTasks {
    constructor(config: BeelzebubConfig) {
      super(config);
      this.$defineTaskVars('capture', {
        text: { type: 'string' },
        count: { type: 'number', required: true },
        enabled: { type: 'boolean', alias: 'e' },
        list: { type: 'array' },
        settings: {
          type: 'object',
          properties: {
            retries: { type: 'number', default: 3 },
            label: { type: 'string' }
          }
        },
        fallback: { type: 'string', default: 'ready' }
      });
    }

    capture(vars: Record<string, unknown>): void {
      captured.push(vars);
    }
  };
}

describe('task variable definitions', () => {
  it('coerces aliases, primitive values, arrays, and nested objects', async () => {
    const { config, logger } = createTestConfig();
    const app = bz.create(config);
    const captured: Array<Record<string, unknown>> = [];
    const VarsTasks = createVarsTasks(captured);

    app.add(VarsTasks);
    await app.getInitPromise();
    await app.run({
      task: 'VarsTasks.capture',
      vars: {
        text: 99,
        count: '42',
        e: 'TRUE',
        list: '["one","two"]',
        settings: '{"retries":"5","label":7}'
      }
    });

    expect(captured[0]).toEqual({
      text: '99',
      count: 42,
      e: 'TRUE',
      enabled: true,
      list: ['one', 'two'],
      settings: { retries: 5, label: '7' },
      fallback: 'ready'
    });

    await app.run({
      task: 'VarsTasks.capture',
      vars: {
        text: 'ready',
        count: 1,
        enabled: 0,
        list: ['already-an-array'],
        settings: { retries: 2, label: 'configured' },
        fallback: 'explicit'
      }
    });
    expect(captured[1]).toEqual({
      text: 'ready',
      count: 1,
      enabled: false,
      list: ['already-an-array'],
      settings: { retries: 2, label: 'configured' },
      fallback: 'explicit'
    });
    expect(logger.messages('error')).toEqual(
      expect.arrayContaining([
        'text is not a string but defined as one, converting to string',
        'count is not a number but defined as one, converting to number',
        'enabled is not a boolean but defined as one, converting to boolean'
      ])
    );
  });

  it('uses type defaults and reports required values', async () => {
    const { config, logger } = createTestConfig();
    const app = bz.create(config);
    const captured: Array<Record<string, unknown>> = [];
    const VarsTasks = createVarsTasks(captured);

    app.add(VarsTasks);
    await app.getInitPromise();
    await app.run({ task: 'VarsTasks.capture', vars: {} });

    expect(captured[0]).toEqual({
      text: '',
      count: 0,
      enabled: false,
      list: [],
      settings: {},
      fallback: 'ready'
    });
    expect(logger.messages('error')).toContain('Var "count" is required but not set in vars.');
  });

  it('falls back for malformed arrays and objects and warns about invalid definitions', async () => {
    const { config, logger } = createTestConfig();
    const app = bz.create(config);
    const captured: Array<Record<string, unknown>> = [];

    class EdgeVarsTasks extends BzTasks {
      constructor(taskConfig: BeelzebubConfig) {
        super(taskConfig);
        const definitions: VarDefMap = {
          csv: { type: 'array' },
          wrapped: { type: 'array' },
          badObject: { type: 'object', properties: { value: { type: 'string' } } },
          wrappedObject: { type: 'object', properties: { data: { type: 'number' } } },
          missingProperties: { type: 'object' },
          mystery: { type: 'custom' }
        };
        this.$defineTaskVars('capture', definitions);
      }

      capture(vars: Record<string, unknown>): void {
        captured.push(vars);
      }
    }

    app.add(EdgeVarsTasks);
    await app.getInitPromise();
    await app.run({
      task: 'EdgeVarsTasks.capture',
      vars: {
        csv: 'a,b',
        wrapped: 5,
        badObject: 'not-json',
        wrappedObject: 8,
        missingProperties: {},
        mystery: 'value'
      }
    });

    expect(captured[0]).toEqual({
      csv: ['a', 'b'],
      wrapped: [5],
      badObject: { data: 'not-json', value: '' },
      wrappedObject: { data: 8 },
      missingProperties: {},
      mystery: 'value'
    });
    expect(logger.messages('warn')).toContain('Unknown Variable Definition Type: custom');
    expect(logger.messages('error').join('\n')).toContain('json parsing error');
    expect(logger.messages('error').join('\n')).toContain('properties is not defined as object');
  });
});
