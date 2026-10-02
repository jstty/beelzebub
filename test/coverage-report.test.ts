import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createCoverageReport } from '../scripts/coverage-report.js';

describe('coverage report', () => {
  it('renders deterministic coverage Markdown with a workflow link', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'beelzebub-coverage-'));
    const summaryPath = path.join(directory, 'summary.json');
    writeFileSync(
      summaryPath,
      JSON.stringify({
        total: {
          statements: { pct: 95 },
          branches: { pct: 90 },
          functions: { pct: 75 },
          lines: { pct: 42 }
        }
      })
    );
    try {
      await expect(
        createCoverageReport({ summaryPath, runUrl: 'https://github.example/run/1' })
      ).resolves.toContain('Statements: 95%');
      const report = await createCoverageReport({ summaryPath });
      expect(report).toContain('Required threshold: **90%**');
      expect(report).toContain('Functions: 75%');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('reports a missing coverage file without throwing', async () => {
    await expect(
      createCoverageReport({ summaryPath: '/definitely/missing/coverage.json' })
    ).resolves.toContain('Coverage did not produce a summary.');
  });
});
