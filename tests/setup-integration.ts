import { cleanupTestDb, disconnectTestDb, getTestPrisma } from './helpers/testDb'

beforeAll(async () => {
  // Start the integration suite with a clean database.
  await cleanupTestDb()
  // Ensure the singleton is created and connected before the suite runs.
  getTestPrisma()
})

afterAll(async () => {
  // Clean up and release the shared connection pool so Jest can exit cleanly.
  await cleanupTestDb()
  await disconnectTestDb()
})
