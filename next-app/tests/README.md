# Testing Layers

This workspace now has four quality gates:

- `Vitest` unit tests for pure logic
- `Vitest` integration tests backed by `pg-mem`
- `Harness` suites for repeatable AI and workflow invariants
- `Playwright` smoke and nightly browser coverage

## Commands

- `npm run test`
- `npm run test:harness`
- `npm run test:e2e:smoke`
- `npm run test:e2e`

## What runs where

- PR CI runs lint, typecheck, unit/integration/harness, Chromium smoke, and build
- Nightly runs the same base checks plus full Playwright browser coverage
