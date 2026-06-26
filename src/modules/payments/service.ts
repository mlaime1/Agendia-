import { prisma } from '../../config/prisma'
import { AppError } from '../../utils/AppError'
import { AuthUser, getClientAccessLevel } from '../../utils/calendarAuth'
import { CreatePaymentDto, UpdatePaymentDto } from './types'

function determinePaymentStatus(paidAmount: number, finalPrice: number): 'pending' | 'partial' | 'paid' {
  if (paidAmount <= 0) return 'pending'
  if (paidAmount >= finalPrice) return 'paid'
  return 'partial'
}

export const paymentService = {
  async getByTrip(tripId: bigint, user?: AuthUser) {
    const trip = await prisma.trips.findUnique({
      where: { id: tripId },
      select: { client_id: true },
    })
    if (!trip) throw new AppError('Viaje no encontrado', 404)

    if (user) {
      const level = await getClientAccessLevel(user, trip.client_id)
      if (level === 'none') {
        throw new AppError('No tienes acceso a este viaje', 403)
      }
    }

    return prisma.payments.findMany({
      where: { trip_id: tripId },
      orderBy: { paid_at: 'desc' },
    })
  },

  async create(tripId: bigint, data: CreatePaymentDto, user?: AuthUser) {
    const trip = await prisma.trips.findUnique({
      where: { id: tripId },
      select: {
        client_id: true,
        final_price: true,
        paid_amount: true,
        payment_status: true,
      },
    })
    if (!trip) throw new AppError('Viaje no encontrado', 404)

    if (user) {
      const level = await getClientAccessLevel(user, trip.client_id)
      if (level !== 'full') {
        throw new AppError('No tienes permisos para registrar pagos en este viaje', 403)
      }
    }

    const finalPrice = Number(trip.final_price)
    const currentPaid = Number(trip.paid_amount)
    const newPaid = currentPaid + data.amount

    if (newPaid > finalPrice) {
      throw new AppError(
        `El pago excede el monto del viaje. Pendiente: $${finalPrice - currentPaid}`,
        400
      )
    }

    const newStatus = determinePaymentStatus(newPaid, finalPrice)

    const [payment] = await prisma.$transaction([
      prisma.payments.create({
        data: {
          trip_id: tripId,
          amount: data.amount,
          method: data.method,
          notes: data.notes ?? null,
        },
      }),
      prisma.trips.update({
        where: { id: tripId },
        data: {
          paid_amount: newPaid,
          payment_status: newStatus,
        },
      }),
    ])

    return payment
  },

  async update(paymentId: bigint, data: UpdatePaymentDto, user?: AuthUser) {
    const payment = await prisma.payments.findUnique({
      where: { id: paymentId },
      include: { trips: true },
    })
    if (!payment) throw new AppError('Pago no encontrado', 404)

    const trip = payment.trips

    if (user) {
      const level = await getClientAccessLevel(user, trip.client_id)
      if (level !== 'full') {
        throw new AppError('No tienes permisos para modificar este pago', 403)
      }
    }

    const finalPrice = Number(trip.final_price)
    const currentPaid = Number(trip.paid_amount)
    const diff = (data.amount ?? Number(payment.amount)) - Number(payment.amount)
    const newPaid = currentPaid + diff

    if (newPaid > finalPrice) {
      throw new AppError(
        `El nuevo monto excede el precio del viaje. Máximo permitido: $${finalPrice - (currentPaid - Number(payment.amount))}`,
        400
      )
    }

    const newStatus = determinePaymentStatus(newPaid, finalPrice)

    const [updatedPayment] = await prisma.$transaction([
      prisma.payments.update({
        where: { id: paymentId },
        data: {
          ...(data.amount !== undefined && { amount: data.amount }),
          ...(data.method !== undefined && { method: data.method }),
          ...(data.notes !== undefined && { notes: data.notes }),
        },
      }),
      prisma.trips.update({
        where: { id: trip.id },
        data: {
          paid_amount: newPaid,
          payment_status: newStatus,
        },
      }),
    ])

    return updatedPayment
  },

  async delete(paymentId: bigint, user?: AuthUser) {
    const payment = await prisma.payments.findUnique({
      where: { id: paymentId },
      include: { trips: true },
    })
    if (!payment) throw new AppError('Pago no encontrado', 404)

    const trip = payment.trips

    if (user) {
      const level = await getClientAccessLevel(user, trip.client_id)
      if (level !== 'full') {
        throw new AppError('No tienes permisos para eliminar este pago', 403)
      }
    }

    const finalPrice = Number(trip.final_price)
    const currentPaid = Number(trip.paid_amount)
    const newPaid = Math.max(0, currentPaid - Number(payment.amount))
    const newStatus = determinePaymentStatus(newPaid, finalPrice)

    await prisma.$transaction([
      prisma.payments.delete({ where: { id: paymentId } }),
      prisma.trips.update({
        where: { id: trip.id },
        data: {
          paid_amount: newPaid,
          payment_status: newStatus,
        },
      }),
    ])

    return { deleted: true }
  },
}
