import { Response, NextFunction } from 'express'
import { AuthRequest } from '../../middlewares/verifyToken'
import { paymentService } from './service'
import { CreatePaymentDto, UpdatePaymentDto } from './types'

function _paramToString(param: string | string[] | undefined): string | undefined {
  if (param === undefined) return undefined
  return Array.isArray(param) ? param[0] : param
}

export const paymentController = {
  async getByTrip(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tripIdStr = _paramToString(req.params.tripId)
      if (!tripIdStr) return res.status(400).json({ success: false, message: 'tripId is required' })
      const payments = await paymentService.getByTrip(BigInt(tripIdStr), req.user)
      res.json({ success: true, data: payments })
    } catch (error) { next(error) }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tripIdStr = _paramToString(req.params.tripId)
      if (!tripIdStr) return res.status(400).json({ success: false, message: 'tripId is required' })
      const payment = await paymentService.create(BigInt(tripIdStr), req.body as CreatePaymentDto, req.user)
      res.status(201).json({ success: true, data: payment })
    } catch (error) { next(error) }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id)
      if (!idStr) return res.status(400).json({ success: false, message: 'id is required' })
      const payment = await paymentService.update(BigInt(idStr), req.body as UpdatePaymentDto, req.user)
      res.json({ success: true, data: payment })
    } catch (error) { next(error) }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id)
      if (!idStr) return res.status(400).json({ success: false, message: 'id is required' })
      const result = await paymentService.delete(BigInt(idStr), req.user)
      res.json({ success: true, data: result })
    } catch (error) { next(error) }
  },
}
