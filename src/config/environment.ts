import 'dotenv/config';

type IntegerOptions = { min?: number; max?: number };

function integerFromEnv(
  name: string,
  fallback: number,
  { min = 1, max = Number.MAX_SAFE_INTEGER }: IntegerOptions = {},
) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Invalid ${name}: expected an integer from ${min} to ${max}`);
  }
  return value;
}

export const environment = {
  baseURL: process.env.BASE_URL ?? 'https://www.demoblaze.com',
  apiURL: process.env.API_URL ?? 'https://api.demoblaze.com',
  workers: integerFromEnv('WORKERS', 1),
  retries: integerFromEnv('RETRIES', process.env.CI ? 1 : 0, { min: 0 }),
  performance: {
    // Max 10 samples to stay light on the public site.
    samples: integerFromEnv('PERF_SAMPLES', 5, { max: 10 }),
    p95BudgetMs: integerFromEnv('PERF_P95_MS', 2000),
  },
};

// Fail fast on a malformed URL.
for (const url of [environment.baseURL, environment.apiURL]) new URL(url);
