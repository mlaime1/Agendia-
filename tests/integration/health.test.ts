import '../setup-integration'
import request from 'supertest'
import { app } from '../../src/app'

describe('GET /health', () => {
  it('should return 200 with OK message', async () => {
    const response = await request(app).get('/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      success: true,
      message: 'OK',
      database: 'up',
    })
  })
})

describe('404 handler', () => {
  it('should return 404 for unknown routes', async () => {
    const response = await request(app).get('/unknown-route')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({
      success: false,
      message: 'Route not found',
    })
  })
})
