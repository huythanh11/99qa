# DemoBlaze QA Automation Challenge

Playwright + TypeScript tests for the Login and Cart features of [demoblaze.com](https://www.demoblaze.com/), plus the checkout step at the end of the cart flow and the API behind them.

What is in the repo:

- **Test cases:** [`test-cases/DemoBlaze-Test-Suite.xlsx`](test-cases/DemoBlaze-Test-Suite.xlsx). 59 cases for Login, Cart, Checkout and API. 40 are automated, 19 were run manually. The `Automated` column shows which ones have a test; the case ID is in the test title.
- **Findings:** the `Findings` sheet of the same workbook. 9 bugs with steps, actual result and a suggested fix.

## Bugs found

| ID    | Finding                                                                                                                                          | Severity |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| F-006 | Guests who open a product page directly all share **one cart**. Only the home page sets the guest cookie, so the product page sends `cookie:""`. | Critical |
| F-003 | "Thank you for your purchase" is shown even when the request that completes the order fails.                                                     | High     |
| F-001 | An empty cart can be purchased for 0 USD.                                                                                                        | Medium   |
| F-004 | Card number and name accept any text (`not-a-card-number`, `1`, spaces).                                                                         | Medium   |
| F-005 | An expired card date is accepted.                                                                                                                | Medium   |
| F-007 | The full card number is printed on the confirmation popup.                                                                                       | Medium   |
| F-002 | The month on the receipt is off by one (`getMonth()` is zero-based).                                                                             | Low      |
| F-008 | Double-clicking Purchase sends two requests.                                                                                                     | Low      |
| F-009 | Empty username, password or token makes the API return HTTP 500.                                                                                 | Low      |

F-001 to F-006 and F-009 each have an automated test tagged `@known-bug`. These tests assert the correct behaviour, so they fail on the live site. The default commands skip them to keep the main suite green; `npm run test:known-bugs` runs them. F-007 and F-008 were found manually.

DemoBlaze has no written requirements. For card format and expiry (F-004, F-005) the expected result is my assumption of what a shop should do, and is marked as "Proposed acceptance" in the workbook.

## Quick start

Needs Node 20.19+ (see `.nvmrc`) and access to `www.demoblaze.com` and `api.demoblaze.com`. No credentials needed, each run registers its own account.

```sh
npm ci
npx playwright install chromium          # add firefox webkit for regression
npm run test:demo                        # login + add to cart + place order
npm run report                           # open the HTML report
```

Add `-- --headed` to watch the browser, `-- --debug` to step through, or `-- --grep CART-003` to run one case.

## Commands

| Command                    | What it runs                                                   | When                |
| -------------------------- | -------------------------------------------------------------- | ------------------- |
| `npm run test:demo`        | The two challenge scenarios on Chromium                        | Demo                |
| `npm run test:smoke`       | `@smoke` tests on Chromium + API                               | Every push, PR      |
| `npm test`                 | Chromium UI + API, without known bugs                          | Local default       |
| `npm run test:regression`  | All UI tests on Chromium, Firefox, WebKit + API                | Weekly, pre-release |
| `npm run test:mobile`      | `@smoke` tests on Pixel 7 emulation, including `@mobile` cases | Weekly              |
| `npm run test:api`         | API tests only, no browser                                     | Fast feedback       |
| `npm run test:known-bugs`  | The 8 `@known-bug` tests. **Red until the bugs are fixed**     | Release review      |
| `npm run test:unit`        | Unit tests for helpers under `src/`                            | Every CI job        |
| `npm run test:performance` | Catalog API latency, 5 sequential requests                     | Weekly              |
| `npm run test:all`         | Everything, including known bugs                               | Ad hoc              |
| `npm run typecheck`        | TypeScript check                                               | Every push          |
| `npm run lint`             | ESLint                                                         | Every push          |
| `npm run format`           | Prettier                                                       | Before commit       |
| `npm run evidence`         | Save a short JSON record of the last run to `docs/evidence/`   | When needed         |

## Project structure

```text
src/
  api/          endpoints.ts                   API paths in one place
                demoblaze-client.ts            signup, login, catalog, cart calls
                schema.ts                      runtime checks for API responses
  pages/        home.page.ts  product.page.ts  cart.page.ts
    components/ navbar.component.ts  login-modal.component.ts  order-modal.component.ts
  fixtures/     test.fixture.ts                account, page objects, API sign-in, cart cleanup, checkout setup
  helpers/      api-client.ts                  generic HTTP helper: get, post, put, delete
                assertions.ts  dialogs.ts  price.ts
  config/       environment.ts                 .env loading and validation
  data/         account.ts  order.ts           test data
tests/
  ui/           login.spec.ts  cart.spec.ts  checkout.spec.ts
  api/          contracts.spec.ts
  performance/  catalog-latency.spec.ts
test-cases/     DemoBlaze-Test-Suite.xlsx
scripts/        summarize-results.mjs          JSON report -> docs/evidence/<run>.json
docs/evidence/  run records and bug screenshots
reports/        generated on each run, not committed
```

`*.test.ts` files under `src/` are unit tests for the helper next to them.

### Tags

| Tag           | Meaning                                                  |
| ------------- | -------------------------------------------------------- |
| `@smoke`      | Core flows, run on every push                            |
| `@regression` | Wider functional, negative and network-failure cases     |
| `@mobile`     | Runs only on the mobile project                          |
| `@known-bug`  | Asserts the correct behaviour for an open bug, fails now |
| `@demo`       | The two challenge scenarios                              |

### How it is built

- Page objects are small: one class per page and one per shared component (navbar, login modal, order modal). They hold locators and actions. Assertions stay in the tests and in `src/helpers/assertions.ts`.
- API code has two layers. `ApiClient` in `src/helpers/` does the HTTP work (status check, body parsing) and knows nothing about DemoBlaze. `DemoBlazeClient` uses it for business calls like `login` or `cart`. API tests that need a raw call use the `http` fixture, for example `http.post(path, { data, expectOk: false })` to assert on a 500.
- Setup goes through the API where possible. The fixture registers one account per worker, signs in by setting the `tokenp_` cookie, and clears the cart before and after each cart test. Only the login tests and the demo flow sign in through the UI.
- Cart checks compare the page with the catalog from the API (title, price, total), not with numbers taken from the page itself.
- Browsers and devices are Playwright projects; suites are tags. So one test can be in smoke and regression without being duplicated.
- No fixed sleeps, no forced clicks, no `test.fail`. Retries are 0 locally and 1 in CI.
- Case IDs are in the test titles, so the workbook, the report and the run records in `docs/evidence/` can be matched by ID.

To add a test: add the row to the workbook, put the case ID in the test title, pick tags. New API paths go into `src/api/endpoints.ts` and new business calls into `DemoBlazeClient` (or a new client class on top of `ApiClient`); a new page gets its own class in `src/pages/` and a fixture in `test.fixture.ts`.

## Configuration

Copy `.env.example` to `.env` or set the variables in the shell.

| Variable       | Default                     | Purpose                                             |
| -------------- | --------------------------- | --------------------------------------------------- |
| `BASE_URL`     | `https://www.demoblaze.com` | Site under test                                     |
| `API_URL`      | `https://api.demoblaze.com` | API used for setup, cleanup and API tests           |
| `WORKERS`      | `1`                         | Parallel workers. Keep 1, the public site is shared |
| `RETRIES`      | `0` local, `1` CI           | Retries per test                                    |
| `RECORD_VIDEO` | unset                       | `1` records video for passing tests too             |
| `PERF_SAMPLES` | `5`                         | Requests in the latency test (1 to 10)              |
| `PERF_P95_MS`  | `2000`                      | Latency budget in ms                                |

## Reports

Each run writes to `reports/`: `html/` (HTML report), `junit.xml`, `results.json` and `artifacts/` (trace, screenshot and video for failed tests). Open a trace with `npx playwright show-trace <trace.zip>`.

`npm run evidence -- reports/results.json <run-id>` saves a short record of the run in `docs/evidence/`: status, attempts and error message per test. Traces are left out because they contain session tokens.

## CI

`.github/workflows/quality.yml` (GitHub Actions):

- **Push to main / pull request:** typecheck, lint, format check, unit tests, smoke on Chromium + API.
- **Weekly (Monday 02:00 UTC):** regression on three browsers, mobile smoke, performance.
- **Manual:** pick smoke, regression, mobile, known-bugs or performance.

The HTML report, JUnit XML and run record are uploaded as artifacts on every run. The workflow has not been run on GitHub yet, only the same npm scripts locally.

## Limitations

- Checkout on DemoBlaze is done in the browser: it shows a random order ID and calls the API to empty the cart. There is no order API, so the tests check the confirmation popup and the cart state only.
- Test accounts cannot be deleted (no endpoint). Carts are cleaned after each test.
- WebKit is not Safari on a real device, and mobile is viewport emulation only.
- The performance test is 5 requests from one machine. It can show that the catalog API became much slower, nothing more.
- 19 cases are manual only. The ones worth automating next are CART-014 (failed delete) and ORDER-013 (double-click Purchase).
