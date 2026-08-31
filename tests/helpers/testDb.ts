import { prisma, closePrisma } from '../../src/config/prisma'

// All tables that tests may write to. Order is not critical because we use
// TRUNCATE ... CASCADE, but listing them explicitly makes the operation explicit.
const TEST_TABLES = [
  'trip_stops',
  'payments',
  'trips',
  'summaries',
  'rates',
  'route_stops',
  'routes',
  'invitation_codes',
  'client_passengers',
  'service_schedules',
  'clients',
  'users',
] as const

/**
 * Reject any database URL that does not clearly belong to a test database.
 * This is a safety net to avoid wiping production/dev data by accident.
 */
function assertTestDatabaseUrl(url: string | undefined): void {
  if (!url) {
    throw new Error(
      'DATABASE_URL is not defined. Tests must load an environment file that points to a dedicated test database.'
    )
  }

  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname
    const isTestDatabase =
      pathname.includes('_test') ||
      pathname.includes('/test') ||
      parsed.hostname.includes('test') ||
      (parsed.hostname.includes('localhost') && pathname.includes('agendia_test'))

    if (!isTestDatabase) {
      throw new Error(
        `Refusing to run tests against a database that does not look like a test database: ${url}. ` +
        'The database name must contain "_test" or "test".'
      )
    }
  } catch (err) {
    // URL constructor also throws on invalid URLs; surface that as a clear error.
    if (err instanceof Error && err.message.startsWith('Refusing')) {
      throw err
    }
    throw new Error(`DATABASE_URL is not a valid PostgreSQL URL: ${url}`)
  }
}

export const getTestPrisma = (): typeof prisma => {
  assertTestDatabaseUrl(process.env.DATABASE_URL)
  return prisma
}

export const cleanupTestDb = async (): Promise<void> => {
  assertTestDatabaseUrl(process.env.DATABASE_URL)

  // Disable triggers (e.g., Supabase auth triggers) while truncating to avoid side effects.
  await prisma.$executeRawUnsafe('SET session_replication_role = replica;')

  const tables = TEST_TABLES.join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`)

  await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;')
}

export const resetTestSequences = async (): Promise<void> => {
  for (const table of TEST_TABLES) {
    const sequenceName = `${table}_id_seq`
    try {
      await prisma.$executeRawUnsafe(
        `ALTER SEQUENCE IF EXISTS "${sequenceName}" RESTART WITH 1;`
      )
    } catch {
      // Some tables may not have a sequence named exactly like this; ignore.
    }
  }
}

export const resetTestDatabase = async (): Promise<void> => {
  await cleanupTestDb()
  await resetTestSequences()
}

export const disconnectTestDb = async (): Promise<void> => {
  await closePrisma()
}
