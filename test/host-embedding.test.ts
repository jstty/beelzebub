import * as actionsCache from '@actions/cache';
import { afterEach, describe, expect, it } from 'vitest';

import bz from '../src/index.js';
import { isActionsCacheAvailable } from '../src/github.js';

class Steps extends bz.Tasks {
  run(): string {
    return 'ran';
  }
  other(): string {
    return 'other';
  }
}

describe('host embedding', () => {
  it('keeps each task class namespace when the instance has a name', async () => {
    const app = bz.create({ name: 'delivery', silent: true });
    app.add(Steps);
    await expect(app.run('Steps.other')).resolves.toBe('other');
    await expect(app.run('delivery.other')).resolves.toEqual([]);
  });

  it('addresses a task method named run', async () => {
    const app = bz.create({ silent: true });
    app.add(Steps);
    await expect(app.run('Steps.run')).resolves.toBe('ran');
  });

  it('still renames a class added with an explicit name', async () => {
    const app = bz.create({ name: 'delivery', silent: true });
    app.add(Steps, { name: 'Custom' });
    await expect(app.run('Custom.run')).resolves.toBe('ran');
  });
});

describe('cache availability without loading @actions/cache', () => {
  const keys = [
    'GITHUB_SERVER_URL',
    'ACTIONS_CACHE_SERVICE_V2',
    'ACTIONS_RESULTS_URL',
    'ACTIONS_CACHE_URL'
  ] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  afterEach(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('matches the installed package for every service and host combination', () => {
    const servers = [
      undefined,
      'https://github.com',
      'https://acme.ghe.com',
      'https://ghes.example.com',
      'http://api.localhost'
    ];
    const flags = [undefined, 'true'];
    for (const server of servers)
      for (const v2 of flags)
        for (const results of [undefined, 'https://results.example'])
          for (const cache of [undefined, 'https://cache.example']) {
            const env = {
              GITHUB_SERVER_URL: server,
              ACTIONS_CACHE_SERVICE_V2: v2,
              ACTIONS_RESULTS_URL: results,
              ACTIONS_CACHE_URL: cache
            };
            for (const key of keys) {
              if (env[key] === undefined) delete process.env[key];
              else process.env[key] = env[key];
            }
            expect(isActionsCacheAvailable(process.env), JSON.stringify(env)).toBe(
              actionsCache.isFeatureAvailable()
            );
          }
  });
});
