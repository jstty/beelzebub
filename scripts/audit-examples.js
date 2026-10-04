import path from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Audits `examples/` like `npm audit --audit-level=high`, except for advisories
 * listed here: each has no fixed release yet and is reachable only through the
 * examples' development tooling. Remove an entry as soon as a fix ships.
 */
const allowed = new Map([
  [
    'GHSA-vfj7-8cjw-p6xm',
    'braces stack exhaustion; no fixed braces release (every version through 3.0.3) as of 2026-10-03. Reached only through gulp and @types/gulp.'
  ]
]);

const projectRoot = path.resolve(import.meta.dirname, '..');
const npmCli = process.env.npm_execpath;
const [command, args] = npmCli
  ? [process.execPath, [npmCli, 'audit', '--json']]
  : ['npm', ['audit', '--json']];
const result = spawnSync(command, args, {
  cwd: path.join(projectRoot, 'examples'),
  encoding: 'utf8',
  shell: !npmCli && process.platform === 'win32'
});

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  process.stderr.write(result.stderr || result.stdout || 'npm audit produced no report.\n');
  process.exit(1);
}
if (report.error) {
  console.error('npm audit failed:', report.error.summary ?? report.error);
  process.exit(1);
}

const blocking = new Map();
const ignored = new Set();
for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const advisory of vulnerability.via) {
    // String entries name a vulnerable dependency; its own entry carries the advisory.
    if (typeof advisory !== 'object') continue;
    if (advisory.severity !== 'high' && advisory.severity !== 'critical') continue;
    const id = String(advisory.url ?? '')
      .split('/')
      .pop();
    if (allowed.has(id)) ignored.add(id);
    else
      blocking.set(id || advisory.title, `${advisory.title} (${advisory.name} ${advisory.range})`);
  }
}

for (const id of ignored) console.warn(`examples audit: allowing ${id}: ${allowed.get(id)}`);
if (blocking.size > 0) {
  console.error('examples audit: high or critical advisories:');
  for (const [id, detail] of blocking) console.error(`  ${id}: ${detail}`);
  process.exit(1);
}
console.log('examples audit: no unallowed high or critical advisories.');
