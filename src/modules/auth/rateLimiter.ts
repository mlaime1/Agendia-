export interface RateLimiterOptions {
  /** Intentos permitidos por ventana y por clave. */
  limit: number
  windowMs: number
  /** Techo de claves recordadas; al llenarse se descarta la más vieja, nunca todas. */
  maxKeys: number
}

export interface RateLimiter {
  /** Consume un intento. Devuelve false cuando la clave ya agotó la ventana. */
  hit(key: string): boolean
  /** Libera la clave, por ejemplo cuando el envío falló y conviene dejar reintentar. */
  reset(key: string): void
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

/**
 * Limitador en memoria con ventana fija. Acotado en memoria: al llegar a
 * `maxKeys` descarta la clave más vieja (no vacía el mapa completo, que
 * devolvería el permiso a claves todavía bloqueadas).
 */
export function createRateLimiter({ limit, windowMs, maxKeys }: RateLimiterOptions): RateLimiter {
  const entries = new Map<string, RateLimitEntry>()
  const capacity = Math.max(1, maxKeys)

  function evictOldest(): void {
    while (entries.size >= capacity) {
      const oldest = entries.keys().next()
      if (oldest.done) return
      entries.delete(oldest.value)
    }
  }

  return {
    hit(key) {
      const now = Date.now()
      const entry = entries.get(key)

      if (!entry || entry.resetAt <= now) {
        evictOldest()
        entries.set(key, { count: 1, resetAt: now + windowMs })
        return true
      }

      if (entry.count >= limit) return false

      entry.count += 1
      return true
    },
    reset(key) {
      entries.delete(key)
    },
  }
}
