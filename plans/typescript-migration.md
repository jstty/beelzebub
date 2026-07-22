# Beelzebub 2.0 modernization status

This branch contains the in-progress 2.0 TypeScript and ESM rewrite. The original 1.x implementation remains on `master` until the release is accepted.

## Release baseline

| Area | 2.0 target |
| --- | --- |
| Runtime | Node.js `>=24.15.0` |
| Tested runtimes | Node.js 24 LTS and Node.js 26 Current |
| Package manager | npm 12 |
| Compiler | TypeScript 7 |
| Compiler API bridge | TypeScript 6 compatibility package |
| Modules | Native ESM only |
| Tests | Vitest 4 with V8 coverage |
| Lint/format | ESLint 10 and Prettier 3 |
| Documentation | TypeDoc plus maintained Markdown guides |

## Implemented on `dev/v2.0`

- Source, CLI, tests, and examples migrated from CommonJS JavaScript to TypeScript and ESM.
- Babel, Lodash, `co`, `when`, yargs, legacy documentation tools, and obsolete test tooling removed.
- Native promises, streams, argument parsing, and ES2024 APIs adopted.
- Standard decorators implemented and exercised through API and CLI examples.
- Root and examples lockfiles regenerated with current dependency majors.
- Gulp example upgraded to Gulp 5; `del` and shelljs replaced with `node:fs` APIs.
- Strict TypeScript 7 source and test checks enabled, including exact optional properties.
- Package tarball tested for ESM exports, TypeScript declarations, and CLI execution.
- CI updated for Node 24/26 on Linux, macOS, and Windows.
- README, task guide, interface guide, migration guide, changelog, and TypeDoc updated.

## Release gates

The release is ready for a beta only when all of these pass from a clean checkout:

1. `npm ci` and `npm --prefix examples ci`
2. `npm run format:check`
3. `npm run lint`
4. `npm run typecheck`
5. `npm test`
6. `npm run coverage`
7. `npm run build`
8. `npm run test:package`
9. `npm run docs:build`
10. `npm run validate-pkg`
11. `npm run audit`

## Release sequence

1. Review and commit the migration on `dev/v2.0`.
2. Publish `2.0.0-beta.1` with the `next` npm dist-tag.
3. Validate representative consumer task files and collect compatibility feedback.
4. Publish a release candidate after the beta gates remain green.
5. Publish and tag `2.0.0`, then update the default npm dist-tag.

The TypeScript 6 compatibility package can be removed once TypeDoc and typescript-eslint consume the TypeScript 7 compiler API directly.
