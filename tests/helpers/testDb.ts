import { PrismaClient } from '@prisma/client'

declare global {
  var __testPrisma: PrismaClient | undefined
}

export const getTestPrisma = (): PrismaClient => {
  if (!globalThis.__testPrisma) {
    globalThis.__testPrisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    })
  }
  return globalThis.__testPrisma
}

export const cleanupTestDb = async (): Promise<void> => {
  const prisma = getTestPrisma()

  await prisma.$executeRawUnsafe('TRUNCATE TABLE trips CASCADE')
  await prisma.$executeRawUnsafe('TRUNCATE TABLE summaries CASCADE')
  await prisma.$executeRawUnsafe('TRUNCATE TABLE rates CASCADE')
  await prisma.$executeRawUnsafe('TRUNCATE TABLE route_stops CASCADE')
  await prisma.$executeRawUnsafe('TRUNCATE TABLE routes CASCADE')
  await prisma.$executeRawUnsafe('TRUNCATE TABLE clients CASCADE')
  await prisma.$executeRawUnsafe('TRUNCATE TABLE users CASCADE')
}

export const disconnectTestDb = async (): Promise<void> => {
  const prisma = globalThis.__testPrisma
  if (prisma) {
    await prisma.$disconnect()
    globalThis.__testPrisma = undefined
  }
}
