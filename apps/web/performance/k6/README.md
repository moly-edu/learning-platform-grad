# k6 Performance Tests

This folder contains API performance tests for `apps/web`.

## Before running

1. Start the Next.js app:

```bash
npm run dev --workspace=apps/web
```

2. Run one of the k6 scripts from the repository root.

3. Put your k6 environment variables in:

```text
apps/web/performance/.env.k6
```

An example template is provided at:

```text
apps/web/performance/.env.k6.example
```

The wrapper script `apps/web/performance/run-k6.ps1` automatically loads `apps/web/performance/.env.k6` before running `k6`.

## Public API test

Runs load tests against endpoints that do not require an authenticated session.

```bash
npm run perf:k6:public --workspace=apps/web
```

Optional environment variables:

```bash
K6_BASE_URL=http://localhost:3000
K6_PROFILE=smoke
K6_WIDGET_QUERY=math
K6_WIDGET_USER_ID=<public-or-existing-user-id>
K6_LESSON_NODE_ID=<existing-lesson-node-id>
```

## Protected API test

Runs load tests against endpoints that require an authenticated session.

```bash
npm run perf:k6:protected --workspace=apps/web
```

Required environment variables:

```bash
K6_SESSION_COOKIE=<full cookie header value for your signed-in session>
```

Useful optional environment variables:

```bash
K6_BASE_URL=http://localhost:3000
K6_PROFILE=load
K6_CLASS_ID=<existing-class-id>
K6_COURSE_ID=<existing-course-id>
K6_HOMEWORK_NODE_ID=<existing-homework-node-id>
K6_WIDGET_ID=<existing-widget-id>
```

## Profiles

Supported `K6_PROFILE` values:

- `smoke`: very light verification
- `load`: normal local load test
- `stress`: gradually increasing load

If not specified, `load` is used.
