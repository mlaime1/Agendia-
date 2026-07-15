import * as dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

// Load the right environment file based on the execution context.
// In tests, jest.config.ts already loads .env.test; this guarantees that
// importing this module directly (e.g., from src/app) does not accidentally
// pull in the development .env file afterwards.
if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: '.env.test' })
} else {
  dotenv.config({ path: '.env' })
}

declare global {
  var prisma: PrismaClient | undefined
  var prismaPool: Pool | undefined
}

function createPrismaClient() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  globalThis.prismaPool = pool
  return new PrismaClient({ adapter })
}

export const prisma = globalThis.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

export const closePrisma = async (): Promise<void> => {
  await prisma.$disconnect()
  const pool = globalThis.prismaPool
  if (pool) {
    await pool.end()
    globalThis.prismaPool = undefined
  }
}
