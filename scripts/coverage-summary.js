import fs from 'node:fs';

const marker = '<!-- beelzebub-coverage-report -->';
const summaryPath = 'coverage/coverage-summary.json';
const outputPath = process.argv[2] ?? 'coverage-summary.md';
const outcome = process.env.COVERAGE_OUTCOME ?? 'success';
const threshold = 90;
const runUrl = process.env.GITHUB_SERVER_URL
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : undefined;

let body;

if (!fs.existsSync(summaryPath)) {
  body = [
    marker,
    '## Test coverage',
    '',
    '❌ Coverage did not produce a summary.',
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
    const passed = value.pct >= threshold;

    return `| ${passed ? '✅' : '❌'} ${label} | ${value.covered} / ${value.total} | ${value.pct}% |`;
  });
  const passed = outcome === 'success';

  body = [
    marker,
    '## Test coverage',
    '',
    '| Metric | Covered | Coverage |',
    '| --- | ---: | ---: |',
    ...rows,
    '',
    `${passed ? '✅' : '❌'} Required threshold: **${threshold}%** for every metric.`,
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
