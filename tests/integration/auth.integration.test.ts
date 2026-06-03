/**
 * Integration tests for auth, invitations, and trip authorization flows.
 * Requires Supabase local instance running (supabase start).
 * Uses real database — test data is cleaned up after each run.
 */
import request from 'supertest'
import { app } from '../../src/app'
import { supabase } from '../../src/lib/supabase'
import { prisma } from '../../src/config/prisma'

const TEST_EMAIL_DRIVER = `test-driver-${Date.now()}@test.com`
const TEST_EMAIL_PASSENGER = `test-pass-${Date.now()}@test.com`
const TEST_PASSWORD = 'TestPass123!'
const TEST_PHONE = '5411223344'

let driverToken: string
let passengerToken: string
let invitationCode: string
let driverDbId: bigint
let passengerDbId: bigint | undefined
let clientId: bigint

beforeAll(async () => {
  // ── Create driver user in Supabase Auth ──
  const { data: authDriver, error: createErr } = await supabase.auth.admin.createUser({
    email: TEST_EMAIL_DRIVER,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (createErr || !authDriver.user) {
    throw new Error(`Failed to create driver auth user: ${createErr?.message}`)
  }

  // The trigger handle_new_user should have created the users row, but upsert to be safe
  const driver = await prisma.users.upsert({
    where: { auth_id: authDriver.user.id },
    update: { role: 'DRIVER' },
    create: {
      auth_id: authDriver.user.id,
      name: 'Integration Test Driver',
      email: TEST_EMAIL_DRIVER,
      role: 'DRIVER',
    },
  })
  driverDbId = driver.id

  // Sign in to get Bearer token
  const { data: session, error: loginErr } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL_DRIVER,
    password: TEST_PASSWORD,
  })
  if (loginErr || !session.session) {
    throw new Error(`Failed to sign in driver: ${loginErr?.message}`)
  }
  driverToken = session.session.access_token
})

afterAll(async () => {
  // Clean up test data
  try {
    if (driverDbId) {
      await prisma.client_passengers.deleteMany({ where: { user_id: driverDbId } })
      await prisma.invitation_codes.deleteMany({ where: { driver_id: driverDbId } })
      await prisma.users.delete({ where: { id: driverDbId } })
    }
    if (passengerDbId) {
      await prisma.client_passengers.deleteMany({ where: { user_id: passengerDbId } })
      await prisma.users.delete({ where: { id: passengerDbId } })
    }
    if (clientId) {
      await prisma.trips.deleteMany({ where: { client_id: clientId } })
      await prisma.rates.deleteMany({ where: { client_id: clientId } })
      await prisma.routes.deleteMany({ where: { client_id: clientId } })
      await prisma.clients.delete({ where: { id: clientId } })
    }
  } catch {
    // Ignore cleanup errors
  }
})

describe('Full integration: driver creates invitation → passenger registers → trip access', () => {
  test('POST /invitations — driver creates invitation code (new client)', async () => {
    const res = await request(app)
      .post('/invitations')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({})

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.code).toBeDefined()
    expect(res.body.data.code).toHaveLength(8)
    expect(res.body.data.expires_at).toBeDefined()

    invitationCode = res.body.data.code
  })

  test('GET /invitations/:code — public validation returns valid', async () => {
    const res = await request(app)
      .get(`/invitations/${invitationCode}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.valid).toBe(true)
    expect(res.body.data.client_id).toBeNull()
  })

  test('POST /auth/register — passenger registers with invitation code', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: TEST_EMAIL_PASSENGER,
        password: TEST_PASSWORD,
        name: 'Test Passenger',
        invitation_code: invitationCode,
        phone: TEST_PHONE,
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.user_role).toBe('PASSENGER')

    passengerToken = res.body.data.session?.access_token
    expect(passengerToken).toBeDefined()
  })

  test('POST /auth/register — rejects reused invitation code', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: `other-${Date.now()}@test.com`,
        password: TEST_PASSWORD,
        name: 'Other User',
        invitation_code: invitationCode,
      })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  test('POST /auth/login — passenger can log in', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: TEST_EMAIL_PASSENGER,
        password: TEST_PASSWORD,
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.session).toBeDefined()

    passengerToken = res.body.data.session.access_token
  })

  test('GET /users/me — passenger returns linked client info', async () => {
    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${passengerToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.type).toBe('passenger')
    expect(res.body.data.clients).toBeDefined()
    expect(res.body.data.clients.length).toBeGreaterThanOrEqual(1)

    clientId = BigInt(res.body.data.clients[0].id)
  })

  test('POST /clients — driver creates a route client for the new passenger', async () => {
    const res = await request(app)
      .post('/clients')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        nombre: 'Route Test Client',
        phone: '54110000000',
        billing_cycle: 'monthly',
        billing_day: 5,
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.driver_id).toBe(driverDbId.toString())
  })

  test('GET /invitations — driver can list their codes', async () => {
    const res = await request(app)
      .get('/invitations')
      .set('Authorization', `Bearer ${driverToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    expect(res.body.data[0].code).toBe(invitationCode)
  })

  test('POST /auth/register — rejects without invitation code', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: `nobody-${Date.now()}@test.com`,
        password: TEST_PASSWORD,
        name: 'No Code User',
      })

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
  })
})
