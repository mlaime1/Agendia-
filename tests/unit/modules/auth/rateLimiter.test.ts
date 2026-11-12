import { createRateLimiter } from '../../../../src/modules/auth/rateLimiter'

describe('rateLimiter', () => {
  beforeEach(() => {
    jest.useRealTimers()
  })

  it('allows up to the limit inside the window and then blocks', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60000, maxKeys: 10 })

    expect(limiter.hit('k')).toBe(true)
    expect(limiter.hit('k')).toBe(true)
    expect(limiter.hit('k')).toBe(false)
    expect(limiter.hit('other')).toBe(true)
  })

  it('allows again once the window expires', () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') })
    const limiter = createRateLimiter({ limit: 1, windowMs: 600000, maxKeys: 10 })

    expect(limiter.hit('k')).toBe(true)
    expect(limiter.hit('k')).toBe(false)

    jest.setSystemTime(new Date('2026-01-01T00:10:01Z'))

    expect(limiter.hit('k')).toBe(true)
  })

  it('frees a key on reset so a failed delivery can be retried', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 600000, maxKeys: 10 })

    expect(limiter.hit('k')).toBe(true)
    expect(limiter.hit('k')).toBe(false)

    limiter.reset('k')

    expect(limiter.hit('k')).toBe(true)
  })

  it('evicting at capacity drops one key, never the whole map', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 600000, maxKeys: 2 })

    expect(limiter.hit('oldest')).toBe(true)
    expect(limiter.hit('middle')).toBe(true)
    expect(limiter.hit('newest')).toBe(true)

    // 'oldest' was evicted alone: the still tracked key keeps its block.
    expect(limiter.hit('middle')).toBe(false)
    expect(limiter.hit('oldest')).toBe(true)
  })
})
