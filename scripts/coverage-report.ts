import { readFile } from 'node:fs/promises';

interface CoverageMetric {
  pct: number;
}

interface CoverageSummary {
  total: Record<'statements' | 'branches' | 'functions' | 'lines', CoverageMetric>;
}

const coverageBands = [
  { minimum: 90, color: '2ea043' },
  { minimum: 70, color: '93b82b' },
  { minimum: 50, color: 'd9a52d' },
  { minimum: 30, color: 'e0872f' },
  { minimum: 0, color: 'b60205' }
];

function badge(label: string, color: string, alt: string): string {
  return `![${alt}](https://img.shields.io/badge/-${encodeURIComponent(label)}-${color}?style=flat-square)`;
}

export interface CoverageReportOptions {
  summaryPath?: string;
  threshold?: number;
  runUrl?: string;
}

export async function createCoverageReport(options: CoverageReportOptions = {}): Promise<string> {
  const summaryPath = options.summaryPath ?? 'coverage/coverage-summary.json';
  const threshold = options.threshold ?? 90;
  const marker = '<!-- beelzebub-coverage-report -->';
  let source: string;
  try {
    source = await readFile(summaryPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return [
      marker,
      '## Test coverage',
      '',
      'Coverage did not produce a summary.',
      options.runUrl ? `[View the workflow run](${options.runUrl}) for details.` : undefined
    ]
      .filter((line) => line !== undefined)
      .join('\n')
      .concat('\n');
  }

  const summary = (JSON.parse(source) as CoverageSummary).total;
  const metrics = [
    ['statements', 'Statements'],
    ['branches', 'Branches'],
    ['functions', 'Functions'],
    ['lines', 'Lines']
  ] as const;
  const rows = metrics.map(([key, label]) => {
    const percentage = summary[key].pct;
    const band = coverageBands.find(({ minimum }) => percentage >= minimum)!;
    return `| ${label} | ${badge(`${percentage}%`, band.color, `${label}: ${percentage}%`)} |`;
  });
  return [
    marker,
    '## Test coverage',
    '',
    '| Metric | Coverage |',
    '| --- | ---: |',
    ...rows,
    '',
    `Required threshold: **${threshold}%** for every metric.`,
    options.runUrl ? '' : undefined,
    options.runUrl ? `[View the workflow run](${options.runUrl}) for the full report.` : undefined
  ]
    .filter((line) => line !== undefined)
    .join('\n')
    .concat('\n');
}
