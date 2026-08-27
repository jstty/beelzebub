# Changelog

Notable project changes are documented here. The format follows Keep a Changelog and the project uses semantic versioning.

## 2.0.0 - Unreleased

### Added

- First-class TypeScript declarations and declaration maps.
- Native ESM and callable CommonJS package exports.
- TC39 standard task decorators.
- TypeScript 7 compilation with a temporary TypeScript 6 tooling compatibility layer.
- Vitest 4 tests, 90% coverage thresholds, tarball consumer tests, and Node 24/26 CI.
- TypeDoc API documentation and a dedicated 1.x migration guide.
- A new responsive product website with an expanded example library, integrated API reference,
  Firebase Hosting configuration, preview deployment, and automated static-site validation.

### Changed

- Minimum runtime is Node.js 24.15.
- Development package manager is npm 12.
- CLI parsing uses `node:util.parseArgs` and native ESM loading.
- Promise, generator, sequence, parallel, and stream execution use native Node and JavaScript APIs.
- Examples use TypeScript and Gulp 5.
- Git dependencies build their untracked `dist/` output through npm's `prepare` lifecycle.

### Fixed

- The CLI accepts separate values for `--file <path>` and `-f <path>` as documented.
- Summary statistics no longer double-count earlier runs when results are added in batches.

### Removed

- Babel and legacy decorator transforms.
- `Beelzebub.cli()`.
- Legacy build, documentation, test, and async dependency stacks.

### Security

- Updated all direct tooling dependencies and regenerated lockfiles.
- Removed vulnerable example and documentation-development dependencies.
- Added root and example audit gates.
