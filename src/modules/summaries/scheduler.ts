import cron from 'node-cron'
import { prisma } from '../../config/prisma'
import { processAutoSummary } from './service'

export function startSummaryScheduler() {
  // Ejecutar todos los días a la 1:00 AM
  cron.schedule('0 1 * * *', async () => {
    console.log('[scheduler] Iniciando generación automática de resúmenes...')

    const clients = await prisma.passenger.findMany({
      select: { id: true },
    })

    let created = 0
    let skipped = 0
    let errors = 0

    for (const client of clients) {
      const result = await processAutoSummary(client.id)

      if (result.status === 'created') {
        created++
        console.log(`[scheduler] Resumen creado: cliente=${client.id} summary=${result.summaryId}`)
      } else if (result.status === 'skipped') {
        skipped++
      }
    }

    console.log(
      `[scheduler] Finalizado — creados: ${created}, saltados: ${skipped}, total: ${clients.length}`
    )
  })

  console.log('[scheduler] Programado para ejecutarse diariamente a la 1:00 AM')
}
