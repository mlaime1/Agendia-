import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

(BigInt.prototype as any).toJSON = function () {
  return this.toString()
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function countAll() {
  const [
    users,
    clients,
    routes,
    route_stops,
    rates,
    trips,
    trip_stops,
    payments,
    summaries,
    service_schedules,
    invitation_codes,
    client_passengers,
  ] = await Promise.all([
    prisma.users.count(),
    prisma.clients.count(),
    prisma.routes.count(),
    prisma.route_stops.count(),
    prisma.rates.count(),
    prisma.trips.count(),
    prisma.trip_stops.count(),
    prisma.payments.count(),
    prisma.summaries.count(),
    prisma.service_schedules.count(),
    prisma.invitation_codes.count(),
    prisma.client_passengers.count(),
  ])

  return {
    users,
    clients,
    routes,
    route_stops,
    rates,
    trips,
    trip_stops,
    payments,
    summaries,
    service_schedules,
    invitation_codes,
    client_passengers,
  }
}

async function backupData(backupDir: string) {
  console.log('Generando backup de las tablas que se van a limpiar...')

  const backup = {
    timestamp: new Date().toISOString(),
    tables: {
      routes: await prisma.routes.findMany(),
      route_stops: await prisma.route_stops.findMany(),
      rates: await prisma.rates.findMany(),
      trips: await prisma.trips.findMany(),
      trip_stops: await prisma.trip_stops.findMany(),
      payments: await prisma.payments.findMany(),
      summaries: await prisma.summaries.findMany(),
      service_schedules: await prisma.service_schedules.findMany(),
      invitation_codes: await prisma.invitation_codes.findMany(),
      client_passengers: await prisma.client_passengers.findMany(),
    },
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = join(backupDir, `clean-db-backup-${timestamp}.json`)
  writeFileSync(backupPath, JSON.stringify(backup, null, 2))

  console.log(`Backup guardado en: ${backupPath}`)
  return backupPath
}

async function cleanData() {
  console.log('\nIniciando limpieza parcial de la base de datos...')
  console.log('Se preservan: users, clients')
  console.log('Se eliminan: routes, route_stops, rates, trips, trip_stops, payments, summaries, service_schedules, invitation_codes, client_passengers\n')

  const before = await countAll()
  console.log('Conteos ANTES de la limpieza:')
  console.table(before)

  // Orden de borrado respetando dependencias de FK (hojas primero)
  console.log('\nBorrando trip_stops...')
  await prisma.trip_stops.deleteMany()

  console.log('Borrando payments...')
  await prisma.payments.deleteMany()

  console.log('Borrando trips...')
  await prisma.trips.deleteMany()

  console.log('Borrando summaries...')
  await prisma.summaries.deleteMany()

  console.log('Borrando rates...')
  await prisma.rates.deleteMany()

  console.log('Borrando route_stops...')
  await prisma.route_stops.deleteMany()

  console.log('Borrando routes...')
  await prisma.routes.deleteMany()

  console.log('Borrando service_schedules...')
  await prisma.service_schedules.deleteMany()

  console.log('Borrando invitation_codes...')
  await prisma.invitation_codes.deleteMany()

  console.log('Borrando client_passengers...')
  await prisma.client_passengers.deleteMany()

  const after = await countAll()
  console.log('\nConteos DESPUÉS de la limpieza:')
  console.table(after)
}

async function main() {
  const projectRoot = join(__dirname, '..')
  const backupDir = join(projectRoot, 'backups')
  mkdirSync(backupDir, { recursive: true })

  const beforeCounts = await countAll()

  if (beforeCounts.users === 0 && beforeCounts.clients === 0) {
    console.warn('Advertencia: no hay users ni clients en la base de datos. Se preservarán las tablas vacías.')
  }

  await backupData(backupDir)
  await cleanData()

  console.log('\nLimpieza completada exitosamente.')
}

main()
  .catch((error) => {
    console.error('\nError durante la limpieza:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
