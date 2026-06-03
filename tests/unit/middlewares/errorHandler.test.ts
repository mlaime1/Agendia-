import { errorHandler } from '../../../src/middlewares/errorHandler'
import { AppError } from '../../../src/utils/AppError'
import { Request, Response, NextFunction } from 'express'

describe('errorHandler', () => {
  const mockReq = {} as Request
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response
  const mockNext = jest.fn() as NextFunction

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 500 for generic errors', () => {
    const error = new Error('Something went wrong')

    errorHandler(error, mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Something went wrong',
    })
  })

  it('should return custom statusCode for AppError', () => {
    const error = new AppError('Not found', 404)

    errorHandler(error, mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(404)
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Not found',
    })
  })

  it('should return 500 for non-Error values', () => {
    errorHandler('string error', mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
    })
  })

  it('should return 500 for null/undefined', () => {
    errorHandler(null, mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Internal server error',
    })
  })
})
