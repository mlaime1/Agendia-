import { AppError } from '../../../src/utils/AppError'

describe('AppError', () => {
  it('should create an error with message and statusCode', () => {
    const error = new AppError('Not found', 404)

    expect(error.message).toBe('Not found')
    expect(error.statusCode).toBe(404)
    expect(error.name).toBe('AppError')
  })

  it('should be an instance of Error', () => {
    const error = new AppError('Test', 500)

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(AppError)
  })

  it('should have a stack trace', () => {
    const error = new AppError('Test', 400)

    expect(error.stack).toBeDefined()
    expect(error.stack).toContain('AppError')
  })
})
