import express from 'express'
import request from 'supertest'
import cron from 'node-cron'
import router from '../../../../src/modules/summaries/routes'
import { startSummaryScheduler } from '../../../../src/modules/summaries/scheduler'

jest.mock('../../../../src/config/prisma', () => ({ prisma: {} }))
jest.mock('../../../../src/middlewares/verifyToken', () => ({
  verifyToken: (req: any, _res: any, next: (error?: unknown) => void) => {
    req.user = { role: 'ADMIN', authId: 'test-admin', dbId: 1n }
    next()
  },
}))
jest.mock('node-cron', () => ({
  __esModule: true,
  default: { schedule: jest.fn() },
}))
jest.mock('../../../../src/modules/summaries/service', () => ({
  createSummaryManual: jest.fn(),
  createSummaryAuto: jest.fn(),
  processAutoSummary: jest.fn(),
}))

const mockService = jest.requireMock('../../../../src/modules/summaries/service') as {
  createSummaryManual: jest.Mock
  createSummaryAuto: jest.Mock
  processAutoSummary: jest.Mock
}

const app = express()
app.use(express.json())
app.use('/summaries', router)

describe('automatic summary deprecation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockService.createSummaryManual.mockResolvedValue({ id: 'manual-summary' })
    mockService.createSummaryAuto.mockResolvedValue({ id: 'automatic-summary' })
  })

  it('does not schedule automatic summaries', () => {
    startSummaryScheduler()

    expect(cron.schedule).not.toHaveBeenCalled()
    expect(mockService.processAutoSummary).not.toHaveBeenCalled()
  })

  it('removes the on-demand automatic-summary endpoint', async () => {
    const response = await request(app).post('/summaries/auto/5').send({ driver_id: '1' })

    expect(response.status).toBe(404)
    expect(mockService.createSummaryAuto).not.toHaveBeenCalled()
    expect(mockService.createSummaryManual).not.toHaveBeenCalled()
  })

  it('keeps manual summary creation available', async () => {
    const response = await request(app).post('/summaries').send({
      client_id: '5',
      driver_id: '1',
      period_start: '2025-01-01',
      period_end: '2025-01-31',
    })

    expect(response.status).toBe(201)
    expect(response.body).toEqual({ success: true, data: { id: 'manual-summary' } })
    expect(mockService.createSummaryManual).toHaveBeenCalledTimes(1)
  })
})
