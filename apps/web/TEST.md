# Testing Guide

This repository now has an initial automated test setup for `apps/web`, which is the application currently containing the main API and business logic used by the thesis project.

## Scope

The current test suite focuses on:

- `class` logic
- `course`-related homework counting logic
- `widget` API routes
- simple assignment lookup route behavior
- authentication form validation flows through E2E

The suite intentionally does **not** cover:

- `auto-assignment`
- `widget-assignment-generator`

Those parts were excluded because they are being reduced or removed from the thesis scope.

## Test Stack

Tests for `apps/web` use:

- `Vitest` for unit and integration tests
- `Playwright` for E2E tests
- `k6` for API performance and load testing

Packages were installed from the monorepo root with `--workspace=apps/web`.

## Test Statistics

Current test totals in `apps/web`:

- Unit test: 8 files, 30 test cases
- Integration test: 9 files, 29 test cases
- E2E test: 4 files, 12 test cases

Overall total:

- 21 test files
- 71 test cases

## Implemented Tests

### Unit tests

Files:

- `apps/web/__tests__/server/classes.unit.test.ts`
- `apps/web/__tests__/server/homework-count-utils.unit.test.ts`
- `apps/web/__tests__/server/class-lesson-node.unit.test.ts`
- `apps/web/__tests__/server/course-structure-utils.unit.test.ts`
- `apps/web/__tests__/server/ansi-parser.unit.test.ts`
- `apps/web/__tests__/server/image-upload.unit.test.ts`
- `apps/web/__tests__/server/github-logs.unit.test.ts`
- `apps/web/__tests__/server/widget-validator.unit.test.ts`

Covered behavior:

- `_getUserClassesByUserId` groups classes into `owner`, `teacher`, and `student`
- `countHomeworksRecursive` aggregates assigned, pending, and correct homework
- `buildHomeworkCountsMap` builds aggregate counts for each node in a lesson tree
- `getBuildRunIdFromLessonNode` resolves `widgetId` and `buildRunId` correctly
- course structure tree utilities:
  - transform node to UI shape
  - find/update/remove/add tree nodes
  - descendant checks
  - move node between parents
  - build tree from flat list
  - merge lazy-loaded children
- ANSI log parsing:
  - strip escape codes
  - map colors/styles into UI segments
  - foreground reset handling
- image upload helpers:
  - base64 image detection
  - base64 size calculation
  - upload success and error handling
- GitHub log mapping:
  - step duration calculation
  - log grouping
  - log-to-step boundary mapping
- widget validation:
  - fetch/network failure
  - CORS failure
  - successful `WIDGET_READY` handshake

### Integration tests

Files:

- `apps/web/__tests__/integration/widgets-search.integration.test.ts`
- `apps/web/__tests__/integration/widgets.integration.test.ts`
- `apps/web/__tests__/integration/mobile-classes.integration.test.ts`
- `apps/web/__tests__/integration/class-assignment.integration.test.ts`
- `apps/web/__tests__/integration/internal-auto-assign-tick.integration.test.ts`
- `apps/web/__tests__/integration/mobile-class.integration.test.ts`
- `apps/web/__tests__/integration/mobile-class-pending-assignments.integration.test.ts`
- `apps/web/__tests__/integration/mobile-homework-assignments.integration.test.ts`
- `apps/web/__tests__/integration/mobile-homework-status.integration.test.ts`

Covered behavior:

- `POST /api/widgets/search`
  - case-insensitive search
  - error handling
- `GET /api/widgets`
  - returns widget list from server layer
- `GET /api/mobile/classes`
  - unauthorized response
  - authenticated response returns only student classes
  - service failure response
- `GET /api/class/assignment`
  - missing `lessonNodeId`
  - not found state
  - success state
  - internal error state
- `GET` / `POST /api/internal/auto-assign/tick`
  - unauthorized request rejection
  - successful execution
  - internal error handling
- `GET /api/mobile/class`
  - unauthorized request
  - missing `classId`
  - forbidden user
  - successful class + nodes payload
- `GET /api/mobile/class/pending-assignments`
  - unauthorized request
  - missing `classId`
  - forbidden user
  - formatted pending assignments response
- `GET /api/mobile/homework/assignments`
  - unauthorized request
  - missing parameters
  - forbidden user
  - assigned assignment formatting and sorting
- `GET /api/mobile/class/homework-status`
  - unauthorized request
  - missing parameters
  - successful homework status response

### E2E tests

Files:

- `apps/web/__tests__/e2e/signin.e2e.spec.ts`
- `apps/web/__tests__/e2e/signup.e2e.spec.ts`
- `apps/web/__tests__/e2e/public-pages.e2e.spec.ts`
- `apps/web/__tests__/e2e/protected-routes.e2e.spec.ts`

Covered behavior:

- sign-in form validation for invalid email and short password
- sign-up form validation for invalid email and short password
- landing page hero and section rendering
- landing page navigation to sign-in and sign-up
- footer GitHub link presence
- cross-navigation between sign-in and sign-up pages
- protected route redirects for dashboard, class detail, and organization pages

These E2E tests currently validate client-side behavior only and do not require a real authenticated user.

## How To Run

Run commands from the monorepo root.

### Run all Vitest tests

```bash
npm run test --workspace=apps/web
```

### Run only unit tests

```bash
npm run test:unit --workspace=apps/web
```

### Run only integration tests

```bash
npm run test:integration --workspace=apps/web
```

### Run E2E tests

```bash
npm run test:e2e --workspace=apps/web
```

### Run public API performance tests

Start the app first:

```bash
npm run dev --workspace=apps/web
```

Then run:

```bash
npm run perf:k6:public --workspace=apps/web
```

### Run protected API performance tests

Start the app first:

```bash
npm run dev --workspace=apps/web
```

Then run:

```bash
npm run perf:k6:protected --workspace=apps/web
```

The protected script requires session and entity IDs through environment variables. See:

- `apps/web/performance/k6/README.md`

## First-Time E2E Setup

Playwright needs a browser installed locally. If Chromium is missing, run:

```bash
npx playwright install chromium
```

## Performance Testing Setup

The `k6` CLI is installed on this machine and is used for API performance testing.

Official installation reference:

- [Grafana k6 installation docs](https://grafana.com/docs/learning-paths/run-first-k6-test/install-k6/)

If a shell session does not immediately recognize `k6`, open a new terminal session or run the binary directly from:

```text
C:\Program Files\k6\k6.exe
```

## API Performance Test Strategy

The API performance tests are executed against the real running `apps/web` server, not against mocks. This is necessary because response-time testing must measure actual HTTP request handling, routing, serialization, database access, and middleware/auth behavior.

The current `k6` strategy is split into two groups:

- Public API load tests:
  - `GET /api/widgets`
  - `POST /api/widgets/search`
  - optional:
    - `GET /api/widgets/users/[userId]`
    - `GET /api/class/assignment`
- Protected API load tests:
  - `GET /api/mobile/classes`
  - optional, when IDs are provided:
    - `GET /api/mobile/class`
    - `GET /api/mobile/class/pending-assignments`
    - `POST /api/mobile/classes/pending-assignments`
    - `GET /api/mobile/class/homework-status`
    - `GET /api/mobile/homework/assignments`
    - `GET /api/widgets/[id]/status`

Three execution profiles are supported:

- `smoke`: light verification
- `load`: normal local load test
- `stress`: gradually increasing concurrent load

The measured indicators are:

- average response time (`avg`)
- median response time (`med`)
- 90th percentile (`p(90)`)
- 95th percentile (`p(95)`)
- maximum response time (`max`)
- failed request rate
- total requests and request rate

## Protected API Environment Variables

The protected script requires an authenticated session, so it cannot run correctly without environment variables.

Minimum required variable:

```text
apps/web/performance/.env.k6
```

Optional variables for broader coverage:

```env
K6_SESSION_COOKIE=better-auth.session_token=your_token_here
K6_CLASS_ID=your-class-id
K6_COURSE_ID=your-course-id
K6_HOMEWORK_NODE_ID=your-homework-node-id
K6_WIDGET_ID=your-widget-id
```

Run command:

```bash
npm run perf:k6:protected --workspace=apps/web
```

The command automatically loads:

```text
apps/web/performance/.env.k6
```

If `K6_SESSION_COOKIE` is missing, the protected test now stops immediately with a clear configuration error instead of spamming repeated execution errors.

## Sample API Performance Results

The following measurements were collected on `2026-05-19` against the local `apps/web` server running at `http://localhost:3000`.

### Public API Smoke Test

Configuration:

- profile: `smoke`
- virtual users: `1`
- duration: `10s`
- endpoints:
  - `GET /api/widgets`
  - `POST /api/widgets/search`

Observed results:

- total requests: `14`
- failed requests: `0.00%`
- average response time: `250.31 ms`
- median response time: `225.26 ms`
- p(90): `304.54 ms`
- p(95): `336.53 ms`
- max response time: `380.08 ms`

Result summary:

- all checks passed
- the smoke test satisfied the configured thresholds:
  - `avg < 600 ms`
  - `p(95) < 1000 ms`
  - failed request rate `< 5%`

### Public API Load Test

Configuration:

- profile: `load`
- virtual users: `5`
- duration: `20s`
- endpoints:
  - `GET /api/widgets`
  - `POST /api/widgets/search`

Observed results:

- total requests: `132`
- request rate: `6.16 req/s`
- failed requests: `0.00%`
- average response time: `279.93 ms`
- median response time: `253.57 ms`
- p(90): `315.34 ms`
- p(95): `372.70 ms`
- max response time: `807.60 ms`

Result summary:

- all checks passed
- the public API remained stable during the short local load test
- average and percentile latency remained below the configured thresholds

### Protected API Load Test

Configuration:

- profile: `load`
- virtual users: `5`
- duration: `30s`
- environment loaded from:
  - `apps/web/performance/.env.k6`
- endpoints:
  - `GET /api/mobile/classes`
  - `GET /api/mobile/class`
  - `GET /api/mobile/class/pending-assignments`
  - `POST /api/mobile/classes/pending-assignments`
  - `GET /api/mobile/class/homework-status`
  - `GET /api/mobile/homework/assignments`
  - `GET /api/widgets/[id]/status`

Observed results:

- total requests: `224`
- request rate: `6.44 req/s`
- failed requests: `0.00%`
- average response time: `569.90 ms`
- median response time: `556.09 ms`
- p(90): `833.05 ms`
- p(95): `865.86 ms`
- max response time: `1.03 s`

Result summary:

- all checks passed
- all configured thresholds passed:
  - `avg < 600 ms`
  - `p(95) < 1000 ms`
  - failed request rate `< 5%`
- protected APIs were noticeably slower than the public widget endpoints, which is reasonable because they involve authentication, membership checks, and more complex data retrieval

### Cause Of Earlier Protected-Test Errors

Two configuration issues were identified during setup:

- `k6` was not available in the workspace PATH when launched from `npm`
- the protected test was previously run without loading `K6_SESSION_COOKIE`

These issues were resolved by:

- adding `apps/web/performance/run-k6.ps1` to launch the installed `k6` binary reliably
- automatically loading `apps/web/performance/.env.k6`
- updating the widget-status request so `404` can be treated as an expected response when benchmarking that route

## Current Notes

- Unit and integration tests are implemented with mocks, so they do not require a live database.
- E2E tests start the local Next.js dev server automatically through Playwright.
- Playwright artifacts are ignored through `apps/web/.gitignore`.
- The current suite is intentionally concentrated on important logic paths, route validation, response shaping, and public user flows that are relevant to the thesis scope.
- API performance tests require the application to be running because they measure real HTTP response time.
- The `apps/web/performance/k6/public-api.js` script targets endpoints that are easiest to benchmark repeatedly in local development.
- The `apps/web/performance/k6/protected-api.js` script supports broader authenticated coverage through environment variables such as `K6_SESSION_COOKIE`, `K6_CLASS_ID`, and `K6_COURSE_ID`.

## Suggested Next Additions

If you want to expand this suite later, the next high-value targets are:

- `src/server/courses.ts`
  - `addLessonNode`
  - `updateLessonNode`
  - `deleteLessonNode`
- `src/server/classes.ts`
  - pending assignment aggregation
- `src/server/widgets.ts`
  - widget query shaping
- mobile API routes for homework status and class detail responses
