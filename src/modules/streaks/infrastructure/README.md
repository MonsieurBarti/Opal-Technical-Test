# Streaks Module - Integration Tests

## Overview

This directory contains integration tests for the Streaks module repositories. These tests use **testcontainers** to spin up real PostgreSQL databases, ensuring that repository implementations work correctly with actual database operations.

## Test Structure

Integration tests are located alongside their corresponding repository implementations in the infrastructure layer:

```
src/modules/streaks/infrastructure/
├── focus-session/
│   ├── sql-focus-session.repository.ts
│   └── focus-session-repository.integration-spec.ts  ← Integration tests
└── user-streak/
    ├── sql-user-streak.repository.ts
    └── user-streak-repository.integration-spec.ts    ← Integration tests
```

## Test Coverage

### FocusSessionRepository (9 tests)

- ✅ Save operations and duplicate prevention
- ✅ Find by ID (idempotency checks)
- ✅ Calculate total minutes for a specific date
- ✅ Query sessions by date range
- ✅ Timezone handling

### UserStreakRepository (12 tests)

- ✅ Save and update operations
- ✅ Find by user ID
- ✅ Find or create pattern
- ✅ Leaderboard queries (top by qualified days)
- ✅ Streak calculation logic (consecutive days, gaps, resets)

## Running Tests

### Run all integration tests:

```bash
npm run test:integration
```

### Run in watch mode:

```bash
npm run test:integration:watch
```

### Run specific test file:

```bash
npm run test:integration -- focus-session-repository
```

## Test Infrastructure

### Testcontainers

- Each test suite starts a fresh PostgreSQL 16 container
- Prisma migrations are automatically applied
- Database is cleaned between tests (`afterEach`)
- Container is torn down after all tests complete

### Test Helpers

Located in `src/modules/streaks/test/e2e/`:

- `testcontainers-setup.ts` - Container lifecycle management
- `test-helpers.ts` - Factory functions for test data

## Key Features

✅ **Real Database Testing** - Uses actual PostgreSQL (not mocks)  
✅ **Isolated** - Each test suite gets its own container  
✅ **Fast** - Tests complete in ~5 seconds  
✅ **Reliable** - No shared state between tests  
✅ **CI-Ready** - Works in any environment with Docker

## Writing New Integration Tests

1. Create test file alongside the repository: `*.integration-spec.ts`
2. Import testcontainers setup and helpers
3. Follow the existing pattern:

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import {
  setupTestContainer,
  teardownTestContainer,
  cleanDatabase,
} from '../../test/e2e/testcontainers-setup';

describe('MyRepository Integration Tests', () => {
  let testSetup, prisma, repository;

  beforeAll(async () => {
    testSetup = await setupTestContainer();
    prisma = testSetup.prisma;
    repository = new MyRepository(prisma, dateProvider);
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await teardownTestContainer();
  });

  it('should do something', async () => {
    // Test implementation
  });
});
```

## Distinction: Integration vs E2E Tests

- **Integration Tests** (`*.integration-spec.ts`): Test database/service boundaries (repositories, handlers)
- **E2E Tests** (`*.e2e-spec.ts`): Test full API endpoints with HTTP requests

This project currently has **integration tests** for the repository layer.
