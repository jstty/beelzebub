import fs from 'node:fs';

const marker = '<!-- beelzebub-coverage-report -->';
const summaryPath = 'coverage/coverage-summary.json';
const outputPath = process.argv[2] ?? 'coverage-summary.md';
const threshold = 90;
const coverageBands = [
  { minimum: 90, color: '2ea043' },
  { minimum: 70, color: '93b82b' },
  { minimum: 50, color: 'd9a52d' },
  { minimum: 30, color: 'e0872f' },
  { minimum: 0, color: 'b60205' }
];
const runUrl = process.env.GITHUB_SERVER_URL
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : undefined;

let body;

function coverageBand(percentage) {
  return coverageBands.find((band) => percentage >= band.minimum);
}

function badge(label, color, alt = label) {
  const message = encodeURIComponent(label);
  return `![${alt}](https://img.shields.io/badge/-${message}-${color}?style=flat-square)`;
}

if (!fs.existsSync(summaryPath)) {
  body = [
    marker,
    '## Test coverage',
    '',
    'Coverage did not produce a summary.',
    runUrl ? `[View the workflow run](${runUrl}) for details.` : undefined
  ]
    .filter((line) => line !== undefined)
    .join('\n');
} else {
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8')).total;
  const metrics = [
    ['statements', 'Statements'],
    ['branches', 'Branches'],
    ['functions', 'Functions'],
    ['lines', 'Lines']
  ];
  const rows = metrics.map(([key, label]) => {
    const value = summary[key];
    const band = coverageBand(value.pct);

    return `| ${label} | ${value.covered} / ${value.total} | ${badge(`${value.pct}%`, band.color, `${label}: ${value.pct}%`)} |`;
  });

  body = [
    marker,
    '## Test coverage',
    '',
    '| Metric | Covered | Coverage |',
    '| --- | ---: | ---: |',
    ...rows,
    '',
    `Required threshold: **${threshold}%** for every metric.`,
    runUrl ? '' : undefined,
    runUrl ? `[View the workflow run](${runUrl}) for the full report.` : undefined
  ]
    .filter((line) => line !== undefined)
    .join('\n');
}

const output = `${body}\n`;

fs.writeFileSync(outputPath, output);
process.stdout.write(output);

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, output);
}
