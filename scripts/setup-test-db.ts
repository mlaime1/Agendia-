/**
 * Creates the test database (if it does not exist) and applies Prisma migrations.
 *
 * Usage:
 *   npx tsx scripts/setup-test-db.ts
 *
 * Requires an .env.test file with a DATABASE_URL pointing to a database whose
 * name contains "_test" or "test" (e.g., postgresql://user:pass@localhost:5432/agendia_test).
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.test' })

import { Client } from 'pg'
import { execSync } from 'node:child_process'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('DATABASE_URL is not defined. Make sure .env.test is loaded.')
  process.exit(1)
}

const parsed = new URL(databaseUrl)
const databaseName = parsed.pathname.replace(/^\//, '')

if (!databaseName.includes('_test') && !databaseName.includes('test')) {
  console.error(
    `Refusing to set up a database that does not look like a test database: ${databaseName}`
  )
  process.exit(1)
}

// Build a connection URL to the default "postgres" administrative database.
const adminUrl = new URL(databaseUrl)
adminUrl.pathname = '/postgres'

async function main() {
  const client = new Client({ connectionString: adminUrl.toString() })

  try {
    await client.connect()

    const { rows } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [databaseName]
    )

    if (rows.length === 0) {
      // PostgreSQL does not allow parameters for CREATE DATABASE, so we quote the identifier.
      await client.query(`CREATE DATABASE "${databaseName}"`)
      console.log(`Created database: ${databaseName}`)
    } else {
      console.log(`Database already exists: ${databaseName}`)
    }
  } finally {
    await client.end()
  }

  // Run Prisma migrations against the test database.
  console.log('Applying migrations...')
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  })

  console.log('Test database is ready.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
