import { asyncHandler } from '../../../src/utils/asyncHandler'
import { Request, Response, NextFunction } from 'express'

describe('asyncHandler', () => {
  const mockReq = {} as Request
  const mockRes = {} as Response
  const mockNext = jest.fn() as NextFunction

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should call the handler and pass result', async () => {
    const handler = jest.fn().mockResolvedValue(undefined)
    const wrapped = asyncHandler(handler)

    await wrapped(mockReq, mockRes, mockNext)

    expect(handler).toHaveBeenCalledWith(mockReq, mockRes, mockNext)
    expect(mockNext).not.toHaveBeenCalled()
  })

  it('should call next() when handler rejects', async () => {
    const error = new Error('Async error')
    const handler = jest.fn().mockRejectedValue(error)
    const wrapped = asyncHandler(handler)

    await wrapped(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalledWith(error)
  })

  it('should call next() when handler returns rejected promise', async () => {
    const error = new Error('Rejected')
    const handler = jest.fn().mockImplementation(() => {
      return Promise.reject(error)
    })
    const wrapped = asyncHandler(handler)

    await wrapped(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalledWith(error)
  })
})
