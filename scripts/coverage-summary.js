import fs from 'node:fs';

const marker = '<!-- beelzebub-coverage-report -->';
const summaryPath = 'coverage/coverage-summary.json';
const outputPath = process.argv[2] ?? 'coverage-summary.md';
const outcome = process.env.COVERAGE_OUTCOME ?? 'success';
const threshold = 90;
const coverageBands = [
  { minimum: 90, label: '90+', color: '2ea043' },
  { minimum: 80, label: '80–<90', color: '5da62b' },
  { minimum: 70, label: '70–<80', color: '93b82b' },
  { minimum: 60, label: '60–<70', color: 'c5b82e' },
  { minimum: 50, label: '50–<60', color: 'd9a52d' },
  { minimum: 40, label: '40–<50', color: 'e0872f' },
  { minimum: 30, label: '30–<40', color: 'dc6733' },
  { minimum: 20, label: '20–<30', color: 'd64b36' },
  { minimum: Number.EPSILON, label: '>10–<20', color: 'c92f35' },
  { minimum: 0, label: '0–10', color: 'b60205' }
];
const runUrl = process.env.GITHUB_SERVER_URL
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : undefined;

let body;

function coverageBand(percentage) {
  if (percentage <= 10) return coverageBands.at(-1);
  return coverageBands.find((band) => percentage >= band.minimum);
}

function badge(label, color, alt = label) {
  const message = encodeURIComponent(label);
  return `![${alt}](https://img.shields.io/badge/-${message}-${color}?style=flat-square)`;
}

const scale = coverageBands.map((band) => badge(band.label, band.color)).join(' ');

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
    const band = coverageBand(value.pct);

    return `| ${passed ? '✅' : '❌'} ${label} | ${value.covered} / ${value.total} | ${badge(`${value.pct}%`, band.color, `${label}: ${value.pct}%`)} |`;
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
    `**Color scale:** ${scale}`,
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
