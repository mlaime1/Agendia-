import type { Config } from 'jest'
import * as dotenv from 'dotenv'

// Load the dedicated test environment variables before any test module is imported.
dotenv.config({ path: '.env.test' })

const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  testTimeout: 15000,
  clearMocks: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
    '!src/config/prisma.ts',
    '!src/lib/supabase.ts',
  ],
}

export default config
