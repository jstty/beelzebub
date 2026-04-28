## Plan: Modernize Beelzebub to TypeScript (2026 Standards)

Migrate the project to TypeScript on **Node 22 LTS** (tested through Node 24) with native ESM. Source moves from [lib/](../lib/) and [bin/](../bin/) to `src/` and compiles to `dist/`. Replace all legacy async libraries (`co`, `when`, `when/sequence`, `stream-to-promise`, `babel-*`) with native `async/await`, `Promise.all`, and `node:stream/promises`. Replace Mocha/Chai with **Vitest 3** (or `node:test` — see Decisions). Adopt **standard TC39 decorators** (not legacy/experimental). Lint with **Biome 2** (or ESLint v9 flat config + `typescript-eslint` v8). Validate the published package with `publint` and `@arethetypeswrong/cli`.

---

### 1. Project Setup & Tooling

- **Engines:** set `"engines": { "node": ">=22.12" }` (current LTS) in [package.json](../package.json). Drop the `>=6` constraint and the entire `babel` block.
- **ESM-first:** add `"type": "module"`. Replace `"main"` with a proper `"exports"` map:
  ```json
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "types": "./dist/index.d.ts",
  "files": ["dist", "bin"]
  ```
- **Bin entries:** point `bin.bz` and `bin.beelzebub` at `./dist/bin/beelzebub.js` (compiled, with shebang preserved via `tsc` + a small post-build `chmod +x` step).
- **TypeScript 5.8+** with this `tsconfig.json`:
  ```jsonc
  {
    "compilerOptions": {
      "target": "ES2023",
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "lib": ["ES2023"],
      "outDir": "dist",
      "rootDir": "src",
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "exactOptionalPropertyTypes": true,
      "verbatimModuleSyntax": true,
      "isolatedModules": true,
      "declaration": true,
      "declarationMap": true,
      "sourceMap": true,
      "resolveJsonModule": true,
      "skipLibCheck": true
      // NOTE: do NOT set experimentalDecorators — use standard TC39 decorators
    },
    "include": ["src"]
  }
  ```
- **Dev runner:** use `tsx` for running TS scripts/examples directly. Node 24 strips types natively, but `tsx` keeps the dev experience consistent across Node 22 LTS and 24.
- **Package manager:** standardize on **pnpm 9+** (lockfile committed). Add a `"packageManager"` field.
- **Formatter/Linter:**
  - **Option A (recommended):** Biome 2 — single tool for format + lint, near-zero config, very fast.
  - **Option B:** ESLint v9 flat config (`eslint.config.js`) + `typescript-eslint` v8 + Prettier 3.

### 2. Dependency Cleanup

**Remove:**
`babel-runtime`, `babel-cli`, `babel-eslint`, `babel-plugin-*`, `babel-polyfill`, `babel-preset-*`, `babel-register`, `co`, `when`, `stream-to-promise`, `mocha`, `chai`, `istanbul`, `eslint-config-standard`, `eslint-plugin-standard`, `coveralls` (use Codecov action instead), `ink-docstrap`, `docdown`, `jsdoc`, `docdash` (replace docs pipeline — see step 6), `glob` (Node 22 has `fs.glob`), `shelljs` (use `node:fs` + `execa`).

**Replace:**
- `chalk@2` → `picocolors` (smaller, ESM, no deps) or `chalk@5` (ESM-only).
- `lodash` → native ES2023 (`structuredClone`, `Object.groupBy`, `Array.prototype.at`, etc.). Where a specific helper is genuinely needed, import from `lodash-es` per-function.
- `strftime` → native `Intl.DateTimeFormat` or a small helper (only millisecond formatting is used in [lib/beelzebub.js](../lib/beelzebub.js)).
- `yargs` → keep, OR migrate to `node:util.parseArgs` for zero-dep CLI parsing. Yargs is fine if the CLI surface is rich.

**Add (dev):**
`typescript`, `vitest`, `@vitest/coverage-v8`, `tsx`, `@types/node`, `publint`, `@arethetypeswrong/cli`, plus the linter of choice.

### 3. Source Migration ([lib/](../lib/) + [bin/](../bin/) → `src/`)

- Move and rename: `lib/*.js` → `src/*.ts`, `bin/*.js` → `src/bin/*.ts`. Convert `require`/`module.exports` to `import`/`export`.
- **Async refactor in [lib/bzTasksClass.js](../lib/bzTasksClass.js):**
  - `co(function* () { ... yield ... })` → `async () => { ... await ... }`.
  - `when.all(...)` → native `Promise.all`.
  - `whenSeq([...])` (sequential) → `for (const fn of fns) { await fn() }`.
  - `streamToPromise(stream)` → `import { finished } from 'node:stream/promises'; await finished(stream)` (or `pipeline` for transforms).
- **Decorators ([lib/decorators.js](../lib/decorators.js)):** rewrite from legacy `(target, prop, descriptor)` to the **TC39 standard signature** `(value, context: ClassMethodDecoratorContext)`. Use `context.addInitializer(...)` to register the method on the instance at construction time. This replaces the old "mutate the prototype" pattern.
- **Types:** introduce interfaces — `BeelzebubConfig`, `TaskConfig`, `TaskFn`, `LoggerLike`, `StatsSnapshot`, `TaskTree`. Export them from `src/index.ts`.
- **JSON imports:** read `package.json` via `import pkg from '../package.json' with { type: 'json' }` (import attributes — stable in Node 22+, TS 5.3+).
- **`__dirname` / `__filename`:** use `import.meta.dirname` / `import.meta.filename` (Node 22+).

### 4. Test Migration ([test/](../test/) → `test/**/*.test.ts`)

- Replace Mocha + Chai with **Vitest 3**: `import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'`.
- Add `vitest.config.ts` with `coverage.provider: 'v8'`, `environment: 'node'`, `include: ['test/**/*.test.ts']`.
- Convert Chai assertions: `expect(x).to.equal(y)` → `expect(x).toBe(y)`; `.to.deep.equal` → `.toEqual`; `.to.be.a('function')` → `expect(typeof x).toBe('function')`.
- Update [test/util/test_logger.js](../test/util/test_logger.js) and helpers to ESM/TS.
- The CLI integration tests in [test/errors/cli/](../test/errors/cli/) and [test/examples/cli/](../test/examples/cli/) should spawn the compiled `dist/bin/beelzebub.js` via `execa` so they verify the actual published artifact.

### 5. Scripts & Examples Migration

- Convert [scripts/run.js](../scripts/run.js), [scripts/utils.js](../scripts/utils.js), and [scripts/tasks/](../scripts/tasks/) to TS. Wire up new `package.json` scripts:
  ```json
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -w",
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit",
    "validate-pkg": "publint && attw --pack .",
    "prepublishOnly": "pnpm build && pnpm validate-pkg"
  }
  ```
- Convert [examples/api/](../examples/api/) and [examples/cli/](../examples/cli/) to `.ts`. Examples should `import` from the package so they double as smoke tests.

### 6. Documentation

- Drop `jsdoc`, `docdash`, `ink-docstrap`, `docdown`. Replace with **TypeDoc** (reads TS types directly) and emit to `docs/site/`.
- Update [README.md](../README.md): new install instructions, ESM-only consumer example, Node 22+ requirement, **decorator syntax change (breaking)**, removal of generator/`co`-style task functions.

### 7. CI & Cleanup

- GitHub Actions matrix: `node-version: [22, 24]` on `ubuntu-latest` and `macos-latest`. Steps: install (pnpm) → `lint` → `typecheck` → `test` → `build` → `validate-pkg`.
- Delete [legacy/](../legacy/) entirely.
- Delete [test/test-all-nodes.sh](../test/test-all-nodes.sh) (replaced by the CI matrix).

---

### Verification

1. `pnpm build` — `tsc` emits `dist/` with no type errors.
2. `pnpm typecheck` — strict mode passes.
3. `pnpm test` — Vitest suite green; coverage report generated.
4. `pnpm validate-pkg` — `publint` clean and `attw` reports no resolution problems for `node16` / `bundler` consumers.
5. `node dist/bin/beelzebub.js help` — CLI runs from the built artifact.
6. `npm pack` and install the tarball into a scratch project; verify both ESM consumption (`import { Beelzebub } from 'beelzebub'`) and the CLI (`npx bz help`) work.

---

### Decisions

- **Node 22 LTS minimum, not Node 20.** Node 20 enters maintenance in 2026; Node 22 is the active LTS and ships import attributes, `import.meta.dirname`, and the stable `node:test` features we'd want.
- **Standard TC39 decorators, not `experimentalDecorators`.** TS 5.0+ ships them; the legacy flag is now a dead-end. This is the single biggest behavioral change vs. the original plan and is a **breaking API change** for downstream users of `@defaultTask` / `@help` / `@vars`.
- **`verbatimModuleSyntax` + `NodeNext`.** Forces explicit `import type` and matches Node's real ESM resolution — eliminates the bundler/runtime mismatch class of bugs.
- **Vitest over `node:test`.** `node:test` is now solid, but Vitest 3 still wins on snapshots, mocking ergonomics, watch UX, and TS-out-of-the-box. Reconsider `node:test` only if zero test deps is a hard requirement.
- **Biome over ESLint+Prettier (preferred).** One tool, one config, ~10× faster. Keep ESLint only if a specific plugin we rely on has no Biome equivalent.
- **`picocolors` over `chalk`.** Same surface for our usage, far smaller, no ESM/CJS interop pain.
- **Drop `lodash` wholesale.** ES2023 covers our needs; `lodash-es` per-function is the escape hatch.
- **Ship compiled `dist/` + `.d.ts`.** Library best practice in 2026 is still to publish JS + types, not raw TS.
- **`pnpm` as the package manager.** Faster installs, strict hoisting catches phantom deps.
- **Release as `2.0.0`.** ESM-only output, Node 22+, and the decorator rewrite are all breaking.
