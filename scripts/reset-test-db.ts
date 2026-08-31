/**
 * Drops and recreates the test database, then applies Prisma migrations.
 *
 * Usage:
 *   npx tsx scripts/reset-test-db.ts
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
    `Refusing to reset a database that does not look like a test database: ${databaseName}`
  )
  process.exit(1)
}

const adminUrl = new URL(databaseUrl)
adminUrl.pathname = '/postgres'

async function main() {
  const client = new Client({ connectionString: adminUrl.toString() })

  try {
    await client.connect()

    // Terminate existing connections before dropping.
    await client.query(
      `
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = $1
        AND pid <> pg_backend_pid();
      `,
      [databaseName]
    )

    await client.query(`DROP DATABASE IF EXISTS "${databaseName}"`)
    await client.query(`CREATE DATABASE "${databaseName}"`)
    console.log(`Reset database: ${databaseName}`)
  } finally {
    await client.end()
  }

  console.log('Applying migrations...')
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  })

  console.log('Test database has been reset and migrated.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
