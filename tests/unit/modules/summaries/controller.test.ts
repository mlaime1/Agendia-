jest.mock('../../../../src/modules/summaries/service', () => ({
  getAllByClient: jest.fn(),
  getById: jest.fn(),
}))

jest.mock('../../../../src/modules/summaries/pdf', () => ({
  generateSummaryPdf: jest.fn(),
}))

jest.mock('../../../../src/utils/calendarAuth', () => ({
  getClientAccessLevel: jest.fn(),
}))

import { Response } from 'express'
import { AuthRequest } from '../../../../src/middlewares/verifyToken'
import { getByClient, getById, getPdf } from '../../../../src/modules/summaries/controller'
import * as service from '../../../../src/modules/summaries/service'
import { getClientAccessLevel } from '../../../../src/utils/calendarAuth'
import { generateSummaryPdf } from '../../../../src/modules/summaries/pdf'

const mockService = service as any
const mockCalendarAuth = { getClientAccessLevel: getClientAccessLevel as any }

describe('summaries/controller', () => {
  const mockRes = () =>
    ({
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    }) as unknown as Response

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getByClient', () => {
    it('should return 401 when user is not authenticated', async () => {
      const req = { params: { clientId: '5' } } as unknown as AuthRequest
      const res = mockRes()

      await getByClient(req, res)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'No autenticado' })
      expect(mockService.getAllByClient).not.toHaveBeenCalled()
    })

    it('should return 403 when user has no access to the client', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('none')

      const req = {
        params: { clientId: '5' },
        user: { authId: 'auth-1', role: 'client', dbId: BigInt(99) },
      } as unknown as AuthRequest
      const res = mockRes()

      await getByClient(req, res)

      expect(mockCalendarAuth.getClientAccessLevel).toHaveBeenCalledWith(
        req.user,
        BigInt(5)
      )
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No tienes acceso a este cliente',
      })
      expect(mockService.getAllByClient).not.toHaveBeenCalled()
    })

    it('should return summaries when user is the client owner', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockService.getAllByClient.mockResolvedValue([{ id: BigInt(1), client_id: BigInt(5) }])

      const req = {
        params: { clientId: '5' },
        user: { authId: 'auth-1', role: 'client', dbId: BigInt(5) },
      } as unknown as AuthRequest
      const res = mockRes()

      await getByClient(req, res)

       expect(mockService.getAllByClient).toHaveBeenCalledWith('5', req.user)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ id: BigInt(1), client_id: BigInt(5) }],
      })
    })

    it('should return summaries when user is a passenger linked to the client', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockService.getAllByClient.mockResolvedValue([{ id: BigInt(1), client_id: BigInt(5) }])

      const req = {
        params: { clientId: '5' },
        user: { authId: 'auth-1', role: 'PASSENGER', dbId: BigInt(7) },
      } as unknown as AuthRequest
      const res = mockRes()

      await getByClient(req, res)

       expect(mockService.getAllByClient).toHaveBeenCalledWith('5', req.user)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ id: BigInt(1), client_id: BigInt(5) }],
      })
    })

    it('should return summaries when user is the assigned driver', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockService.getAllByClient.mockResolvedValue([{ id: BigInt(1), client_id: BigInt(5) }])

      const req = {
        params: { clientId: '5' },
        user: { authId: 'auth-1', role: 'DRIVER', dbId: BigInt(2) },
      } as unknown as AuthRequest
      const res = mockRes()

      await getByClient(req, res)

       expect(mockService.getAllByClient).toHaveBeenCalledWith('5', req.user)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ id: BigInt(1), client_id: BigInt(5) }],
      })
    })

    it('should return summaries when user is an admin', async () => {
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      mockService.getAllByClient.mockResolvedValue([{ id: BigInt(1), client_id: BigInt(5) }])

      const req = {
        params: { clientId: '5' },
        user: { authId: 'auth-1', role: 'ADMIN', dbId: BigInt(1) },
      } as unknown as AuthRequest
      const res = mockRes()

      await getByClient(req, res)

       expect(mockService.getAllByClient).toHaveBeenCalledWith('5', req.user)
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [{ id: BigInt(1), client_id: BigInt(5) }],
      })
    })
  })

  describe('getById', () => {
    it('should return 401 when user is not authenticated', async () => {
      const req = { params: { id: '1' } } as unknown as AuthRequest
      const res = mockRes()

      await getById(req, res)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'No autenticado' })
      expect(mockService.getById).not.toHaveBeenCalled()
    })

    it('should return 403 when user has no access to the summary client', async () => {
      mockService.getById.mockResolvedValue({ id: BigInt(1), client_id: BigInt(5) })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('none')

      const req = {
        params: { id: '1' },
        user: { authId: 'auth-1', role: 'client', dbId: BigInt(99) },
      } as unknown as AuthRequest
      const res = mockRes()

      await getById(req, res)

      expect(mockCalendarAuth.getClientAccessLevel).toHaveBeenCalledWith(req.user, BigInt(5))
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No tienes acceso a este resumen',
      })
    })

    it('should return summary when user has access', async () => {
      const summary = { id: BigInt(1), client_id: BigInt(5) }
      mockService.getById.mockResolvedValue(summary)
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')

      const req = {
        params: { id: '1' },
        user: { authId: 'auth-1', role: 'client', dbId: BigInt(5) },
      } as unknown as AuthRequest
      const res = mockRes()

      await getById(req, res)

      expect(res.json).toHaveBeenCalledWith({ success: true, data: summary })
    })

    it('should return 404 when summary is not found', async () => {
      mockService.getById.mockRejectedValue(new Error('Resumen no encontrado'))

      const req = {
        params: { id: '999' },
        user: { authId: 'auth-1', role: 'ADMIN', dbId: BigInt(1) },
      } as unknown as AuthRequest
      const res = mockRes()

      await getById(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Resumen no encontrado',
      })
    })
  })

  describe('getPdf', () => {
    it('should return 401 when user is not authenticated', async () => {
      const req = { params: { id: '1' } } as unknown as AuthRequest
      const res = mockRes()

      await getPdf(req, res)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'No autenticado' })
      expect(mockService.getById).not.toHaveBeenCalled()
    })

    it('should return 403 when user has no access to the summary client', async () => {
      mockService.getById.mockResolvedValue({ id: BigInt(1), client_id: BigInt(5) })
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('none')

      const req = {
        params: { id: '1' },
        user: { authId: 'auth-1', role: 'PASSENGER', dbId: BigInt(99) },
      } as unknown as AuthRequest
      const res = mockRes()

      await getPdf(req, res)

      expect(mockCalendarAuth.getClientAccessLevel).toHaveBeenCalledWith(req.user, BigInt(5))
      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'No tienes acceso a este resumen',
      })
    })

    it('should send pdf when user has access', async () => {
      const summary = { id: BigInt(1), client_id: BigInt(5) }
      const pdfBuffer = Buffer.from('pdf-content')
      mockService.getById.mockResolvedValue(summary)
      mockCalendarAuth.getClientAccessLevel.mockResolvedValue('full')
      ;(generateSummaryPdf as jest.Mock).mockResolvedValue(pdfBuffer)

      const req = {
        params: { id: '1' },
        user: { authId: 'auth-1', role: 'PASSENGER', dbId: BigInt(7) },
      } as unknown as AuthRequest
      const res = mockRes()

      await getPdf(req, res)

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf')
      expect(res.send).toHaveBeenCalledWith(pdfBuffer)
    })
  })
})
