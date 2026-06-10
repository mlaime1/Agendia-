import { Response, NextFunction } from 'express'
import { AuthRequest } from '../../middlewares/verifyToken'
import { itineraryService } from './service'
import {
  CreateItineraryDto,
  UpdateItineraryDto,
  CreateStopDto,
  UpdateStopDto,
  CreateRateDto,
  UpdateRateDto,
  MatchRequestDto,
} from './types'

function _paramToString(param: string | string[] | undefined): string | undefined {
  if (param === undefined) return undefined
  return Array.isArray(param) ? param[0] : param
}

export const itineraryController = {
  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const itineraries = await itineraryService.getAll(req.user)
      res.json({ success: true, data: itineraries })
    } catch (error) {
      next(error)
    }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id)
      if (!idStr) return res.status(400).json({ success: false, message: 'id is required' })
      const itinerary = await itineraryService.getById(idStr, req.user)
      res.json({ success: true, data: itinerary })
    } catch (error) {
      next(error)
    }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const itinerary = await itineraryService.create(req.body as CreateItineraryDto, req.user)
      res.status(201).json({ success: true, data: itinerary })
    } catch (error) {
      next(error)
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id)
      if (!idStr) return res.status(400).json({ success: false, message: 'id is required' })
      const itinerary = await itineraryService.update(idStr, req.body as UpdateItineraryDto, req.user)
      res.json({ success: true, data: itinerary })
    } catch (error) {
      next(error)
    }
  },

  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id)
      if (!idStr) return res.status(400).json({ success: false, message: 'id is required' })
      await itineraryService.remove(idStr, req.user)
      res.json({ success: true, message: 'Itinerario eliminado' })
    } catch (error) {
      next(error)
    }
  },

  // ─── Stops ────────────────────────────────────────────────────────────────

  async getStops(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id)
      if (!idStr) return res.status(400).json({ success: false, message: 'id is required' })
      const stops = await itineraryService.getStops(idStr, req.user)
      res.json({ success: true, data: stops })
    } catch (error) {
      next(error)
    }
  },

  async createStop(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id)
      if (!idStr) return res.status(400).json({ success: false, message: 'id is required' })
      const stop = await itineraryService.createStop(idStr, req.body as CreateStopDto, req.user)
      res.status(201).json({ success: true, data: stop })
    } catch (error) {
      next(error)
    }
  },

  async updateStop(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id)
      const stopIdStr = _paramToString(req.params.stopId)
      if (!idStr || !stopIdStr)
        return res.status(400).json({ success: false, message: 'id and stopId are required' })
      const stop = await itineraryService.updateStop(
        idStr,
        stopIdStr,
        req.body as UpdateStopDto,
        req.user,
      )
      res.json({ success: true, data: stop })
    } catch (error) {
      next(error)
    }
  },

  async removeStop(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id)
      const stopIdStr = _paramToString(req.params.stopId)
      if (!idStr || !stopIdStr)
        return res.status(400).json({ success: false, message: 'id and stopId are required' })
      await itineraryService.removeStop(idStr, stopIdStr, req.user)
      res.json({ success: true, message: 'Parada eliminada' })
    } catch (error) {
      next(error)
    }
  },

  // ─── Rates ────────────────────────────────────────────────────────────────

  async getRates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id)
      if (!idStr) return res.status(400).json({ success: false, message: 'id is required' })
      const rates = await itineraryService.getRates(idStr, req.user)
      res.json({ success: true, data: rates })
    } catch (error) {
      next(error)
    }
  },

  async createRate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id)
      if (!idStr) return res.status(400).json({ success: false, message: 'id is required' })
      const rate = await itineraryService.createRate(idStr, req.body as CreateRateDto, req.user)
      res.status(201).json({ success: true, data: rate })
    } catch (error) {
      next(error)
    }
  },

  async updateRate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id)
      const rateIdStr = _paramToString(req.params.rateId)
      if (!idStr || !rateIdStr)
        return res.status(400).json({ success: false, message: 'id and rateId are required' })
      const rate = await itineraryService.updateRate(
        idStr,
        rateIdStr,
        req.body as UpdateRateDto,
        req.user,
      )
      res.json({ success: true, data: rate })
    } catch (error) {
      next(error)
    }
  },

  async removeRate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id)
      const rateIdStr = _paramToString(req.params.rateId)
      if (!idStr || !rateIdStr)
        return res.status(400).json({ success: false, message: 'id and rateId are required' })
      await itineraryService.removeRate(idStr, rateIdStr, req.user)
      res.json({ success: true, message: 'Tarifa eliminada' })
    } catch (error) {
      next(error)
    }
  },

  // ─── Matching ─────────────────────────────────────────────────────────────

  async matchItinerary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await itineraryService.matchItinerary(req.body as MatchRequestDto, req.user)
      res.json({ success: true, data: result })
    } catch (error) {
      next(error)
    }
  },
}
