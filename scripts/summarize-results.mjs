// Turns the Playwright JSON report into a small run record under docs/evidence/.
// Usage: node scripts/summarize-results.mjs [report.json] [run-id]
import fs from 'node:fs/promises';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

const input = process.argv[2] ?? 'reports/results.json';
const runId = process.argv[3] ?? new Date().toISOString().replaceAll(':', '-');
if (!/^[\w.-]+$/.test(runId)) throw new Error('Run ID must be a safe filename');

// Case IDs look like LOGIN-001. Finding IDs (F-001) have a one-letter prefix and are skipped.
const caseIdPattern = /\b[A-Z]{2,}-\d{3}\b/g;

const report = JSON.parse(await fs.readFile(input, 'utf8'));
const tests = [];

function collect(suites) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const last = test.results.at(-1);
        tests.push({
          title: spec.title,
          caseIds: [...new Set(spec.title.match(caseIdPattern) ?? [])],
          tags: spec.tags ?? [],
          project: test.projectName,
          file: spec.file,
          line: spec.line,
          outcome: test.status,
          status: last?.status ?? 'not-run',
          attempts: test.results.length,
          durationMs: test.results.reduce((sum, r) => sum + r.duration, 0),
          // Keep the error message only; stacks and traces can contain tokens.
          error: last?.error?.message ? stripVTControlCharacters(last.error.message).slice(0, 1800) : null,
        });
      }
    }
    collect(suite.suites);
  }
}
collect(report.suites);

const output = {
  runId,
  startedAt: report.stats.startTime,
  durationMs: report.stats.duration,
  platform: `${process.platform}/${process.arch}`,
  node: process.version,
  stats: report.stats,
  tests,
};
await fs.mkdir('docs/evidence', { recursive: true });
await fs.writeFile(path.join('docs/evidence', `${runId}.json`), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ runId, stats: output.stats, tests: tests.length }, null, 2));
