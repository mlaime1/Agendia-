import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // Users
  await prisma.users.upsert({
    where: { id: 1n },
    update: {},
    create: {
      id:         1n,
      name:       'Mauro',
      email:      'maurol.dev@gmail.com',
      alias:      'mauro.lgx',
      created_at: new Date('2026-05-12T14:08:04.284Z'),
    },
  });
  console.log('✅ Users');

  // Clients
  await prisma.clients.upsert({
    where: { id: 2n },
    update: {},
    create: {
      id:            2n,
      nombre:        'Andrea',
      phone:         '1157458676',
      billing_cycle: 'Mensual',
      created_at:    new Date('2026-05-12T14:07:20.918Z'),
    },
  });

  await prisma.clients.upsert({
    where: { id: 3n },
    update: {},
    create: {
      id:            3n,
      nombre:        'Maia',
      phone:         '1168612399',
      billing_cycle: 'Mensual',
      created_at:    new Date('2026-05-12T14:08:45.007Z'),
    },
  });
  console.log('✅ Clients');

  // Routes
  await prisma.routes.upsert({
    where: { id: 1n },
    update: {},
    create: {
      id:         1n,
      name:       'Casa - Escuela',
      client_id:  2n,
      created_at: new Date('2026-05-12T14:09:42.237Z'),
    },
  });

  await prisma.routes.upsert({
    where: { id: 2n },
    update: {},
    create: {
      id:         2n,
      name:       'Abuela - Escuela',
      client_id:  2n,
      created_at: new Date('2026-05-12T14:10:13.419Z'),
    },
  });

  await prisma.routes.upsert({
    where: { id: 3n },
    update: {},
    create: {
      id:         3n,
      name:       'Bernal - Casa',
      client_id:  3n,
      created_at: new Date('2026-05-12T14:10:31.400Z'),
    },
  });
  console.log('✅ Routes');

  // Rates
  await prisma.rates.upsert({
    where: { id: 1n },
    update: {},
    create: {
      id:              1n,
      client_id:       3n,
      route_id:        3n,
      base_price:      4000,
      surcharge_price: null,
      start_date:      new Date('2026-05-01'),
      end_date:        new Date('2026-05-31'),
      created_at:      new Date('2026-05-12T14:15:40.553Z'),
    },
  });
  console.log('✅ Rates');

  console.log('🎉 Seed completo!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });