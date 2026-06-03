import { requireRole } from '../../../src/middlewares/requireRole'
import { AuthRequest } from '../../../src/middlewares/verifyToken'
import { Response, NextFunction } from 'express'

describe('requireRole', () => {
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response
  const mockNext = jest.fn() as NextFunction

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should call next() when user has the required role', () => {
    const req = {
      user: { authId: 'auth-1', role: 'ADMIN', dbId: BigInt(1) },
    } as unknown as AuthRequest

    const middleware = requireRole('ADMIN')
    middleware(req, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
  })

  it('should return 401 when user is not authenticated', () => {
    const req = {} as unknown as AuthRequest

    const middleware = requireRole('ADMIN')
    middleware(req, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'No autenticado',
    })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it('should return 403 when user has wrong role', () => {
    const req = {
      user: { authId: 'auth-1', role: 'DRIVER', dbId: BigInt(1) },
    } as unknown as AuthRequest

    const middleware = requireRole('ADMIN')
    middleware(req, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(403)
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Sin permisos',
    })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it('should return 401 when user is undefined', () => {
    const req = { user: undefined } as unknown as AuthRequest

    const middleware = requireRole('DRIVER')
    middleware(req, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockNext).not.toHaveBeenCalled()
  })
})
