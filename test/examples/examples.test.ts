import { describe, it, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Stumpy from 'stumpy';

import bz_factory, { BzCLI } from '../../src/index.js';
import { testsList } from './tests-list.js';
import type { TestApp, TestFn } from '../util/common.js';

const rootDir = import.meta.dirname;
const examplesDir = path.resolve(rootDir, '..', '..', 'examples');
const originalCwd = process.cwd();

type FileLoader = {
  _loadFile(
    currentDir: string,
    tasks: unknown[],
    file: string,
    displayError?: boolean
  ): Promise<unknown[]>;
};

for (const [group, entries] of Object.entries(testsList)) {
  describe.sequential(group, () => {
    for (const [name, config] of Object.entries(entries)) {
      describe.sequential(name, () => {
        const app: TestApp & { config?: any; file?: string } = {} as any;
        const exampleFile = path.join(examplesDir, group, `${name}.ts`);

        beforeAll(async () => {
          bz_factory.delete();
          const loader = new BzCLI() as unknown as FileLoader;
          const logger = new (Stumpy as any)({
            display: false,
            buffer: { size: 500 }
          });
          const helpLogger = new (Stumpy as any)({
            display: false,
            buffer: { size: 500 }
          });
          app.config = {
            verbose: true,
            logger,
            helpLogger
          };
          app.file = exampleFile;

          // change cwd so example relative paths (e.g. stream.ts, gulp.ts) work
          process.chdir(path.join(examplesDir, group));

          if (config.type !== 'cli') {
            const [wrapper] = await loader._loadFile(
              path.dirname(exampleFile),
              [],
              exampleFile,
              true
            );
            if (typeof wrapper !== 'function')
              throw new Error(`Example did not export a function: ${exampleFile}`);
            const bz = await wrapper(app.config);
            app.tasks = bz;
          }
        }, 60_000);

        afterAll(() => {
          bz_factory.delete();
          process.chdir(originalCwd);
        });

        // Pre-load assertion module synchronously via top-level dynamic import not possible;
        // instead, register a single async test that loads the assertions and runs them.
        it('runs assertions', async () => {
          if (config.type === 'cli') {
            const cli = new BzCLI();
            const bz = await cli.run({
              file: app.file,
              config: app.config,
              args: config.args
            });
            app.tasks = bz;
          }
          const assertionsFile = path.join(rootDir, group, `${name}.ts`);
          const testsMod = await import(/* @vite-ignore */ pathToFileURL(assertionsFile).href);
          const tests: TestFn[] = testsMod.default ?? testsMod;
          for (const t of tests) {
            t(app);
          }
        }, 60_000);
      });
    }
  });
}
