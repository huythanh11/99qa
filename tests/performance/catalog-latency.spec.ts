import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { environment } from '../../src/config/environment.js';
import { test, expect } from '../../src/fixtures/test.fixture.js';

// Latency check for the catalog API: a few sequential read-only requests from one client.
// This is not a load test. Do not run it in parallel against the public site.
test('catalog API p95 latency stays within the budget', { tag: '@performance' }, async ({ api }, testInfo) => {
  const { samples, p95BudgetMs } = environment.performance;
  test.setTimeout(samples * 15_000);

  const durationsMs: number[] = [];
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    await api.catalog();
    durationsMs.push(Math.round(performance.now() - start));
  }
  durationsMs.sort((a, b) => a - b);
  // Nearest-rank p95. With 5 samples this equals the slowest request.
  const p95Ms = durationsMs[Math.ceil(durationsMs.length * 0.95) - 1];

  const result = {
    observedAt: new Date().toISOString(),
    target: environment.apiURL,
    samples,
    durationsMs,
    p95Ms,
    budgetMs: p95BudgetMs,
    passed: p95Ms <= p95BudgetMs,
  };
  const body = JSON.stringify(result, null, 2) + '\n';
  await testInfo.attach('performance.json', { body, contentType: 'application/json' });

  // Also keep a copy in reports/ next to the other run outputs.
  const root = testInfo.config.configFile ? dirname(testInfo.config.configFile) : process.cwd();
  await mkdir(join(root, 'reports'), { recursive: true });
  await writeFile(join(root, 'reports', 'performance.json'), body);

  expect(p95Ms, `p95 over ${samples} sequential samples (ms)`).toBeLessThanOrEqual(p95BudgetMs);
});
