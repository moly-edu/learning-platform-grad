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

## First-Time E2E Setup

Playwright needs a browser installed locally. If Chromium is missing, run:

```bash
npx playwright install chromium
```

## Current Notes

- Unit and integration tests are implemented with mocks, so they do not require a live database.
- E2E tests start the local Next.js dev server automatically through Playwright.
- Playwright artifacts are ignored through `apps/web/.gitignore`.
- The current suite is intentionally concentrated on important logic paths, route validation, response shaping, and public user flows that are relevant to the thesis scope.

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
