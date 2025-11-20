/* eslint-disable no-console */
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let container: StartedPostgreSqlContainer | null = null;
let prisma: PrismaClient | null = null;

export interface TestContainerSetup {
  container: StartedPostgreSqlContainer;
  prisma: PrismaClient;
  databaseUrl: string;
}
/**
 * Setup PostgreSQL testcontainer and run migrations
 * This creates a fresh PostgreSQL instance for E2E tests
 */
export async function setupTestContainer(): Promise<TestContainerSetup> {
  console.log('🐳 Starting PostgreSQL testcontainer...');

  // Start PostgreSQL 16 container
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withExposedPorts(5432)
    .withDatabase('test_db')
    .withUsername('test_user')
    .withPassword('test_password')
    .start();

  const databaseUrl = container.getConnectionUri();
  console.log('✅ Testcontainer started:', databaseUrl);

  // Set DATABASE_URL for Prisma
  process.env.DATABASE_URL = databaseUrl;

  // Create Prisma client
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  // Run migrations
  console.log('🔄 Running Prisma migrations...');
  try {
    await execAsync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    console.log('✅ Migrations completed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }

  // Verify connection
  await prisma.$connect();
  console.log('✅ Prisma connected to testcontainer');

  return {
    container,
    prisma,
    databaseUrl,
  };
}

/**
 * Teardown testcontainer and cleanup resources
 */
export async function teardownTestContainer(): Promise<void> {
  console.log('🧹 Tearing down testcontainer...');

  if (prisma) {
    await prisma.$disconnect();
    console.log('✅ Prisma disconnected');
  }

  if (container) {
    await container.stop();
    console.log('✅ Testcontainer stopped');
  }

  // Reset environment variable
  delete process.env.DATABASE_URL;
}

/**
 * Clean all data from test database between tests
 */
export async function cleanDatabase(prismaClient: PrismaClient): Promise<void> {
  // Delete in correct order to respect foreign key constraints
  await prismaClient.userStreak.deleteMany();
  await prismaClient.focusSession.deleteMany();
  await prismaClient.friendship.deleteMany();
  await prismaClient.user.deleteMany();
}

/**
 * Get the current Prisma client instance
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    throw new Error(
      'Prisma client not initialized. Call setupTestContainer() first.',
    );
  }
  return prisma;
}
