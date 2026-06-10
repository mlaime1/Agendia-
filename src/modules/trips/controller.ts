import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/verifyToken';
import { tripService } from './service';
import { CreateTripDto, UpdateTripDto } from './types';

function _paramToString(param: string | string[] | undefined): string | undefined {
  if (param === undefined) return undefined;
  return Array.isArray(param) ? param[0] : param;
}

export const tripController = {

  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const trips = await tripService.getAll(req.user);
      res.json({ success: true, data: trips });
    } catch (error) { next(error); }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id);
      if (!idStr) return res.status(400).json({ success: false, message: 'id is required' });
      const trip = await tripService.getById(BigInt(idStr), req.user);
      if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });
      res.json({ success: true, data: trip });
    } catch (error) { next(error); }
  },

  async getByClient(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const clientIdStr = _paramToString(req.params.clientId);
      if (!clientIdStr) return res.status(400).json({ success: false, message: 'clientId is required' });
      const trips = await tripService.getByClient(BigInt(clientIdStr), req.user);
      res.json({ success: true, data: trips });
    } catch (error) { next(error); }
  },

  async getByDateRange(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { from, to } = req.query as { from: string; to: string };
      const clientIdStr = _paramToString(req.params.clientId);
      if (!clientIdStr) return res.status(400).json({ success: false, message: 'clientId is required' });
      const clientId = BigInt(clientIdStr);

      if (!from || !to) {
        return res.status(400).json({ success: false, message: 'from y to son requeridos' });
      }

      const trips = await tripService.getByDateRange(clientId, new Date(from), new Date(to), req.user);
      res.json({ success: true, data: trips });
    } catch (error) { next(error); }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const trip = await tripService.create(req.body as CreateTripDto, req.user);
      res.status(201).json({ success: true, data: trip });
    } catch (error) { next(error); }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id);
      if (!idStr) return res.status(400).json({ success: false, message: 'id is required' });
      const trip = await tripService.update(BigInt(idStr), req.body as UpdateTripDto, req.user);
      res.json({ success: true, data: trip });
    } catch (error) { next(error); }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id);
      if (!idStr) return res.status(400).json({ success: false, message: 'id is required' });
      await tripService.delete(BigInt(idStr), req.user);
      res.status(204).send();
    } catch (error) { next(error); }
  },

  async startTrip(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id);
      if (!idStr) return res.status(400).json({ success: false, message: 'id is required' });
      const { lat, lng } = req.body;
      if (lat == null || lng == null) {
        return res.status(400).json({ success: false, message: 'lat y lng son requeridos' });
      }
      const trip = await tripService.startTrip(BigInt(idStr), lat, lng, req.user);
      res.json({ success: true, data: trip });
    } catch (error) { next(error); }
  },

  async addStop(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id);
      if (!idStr) return res.status(400).json({ success: false, message: 'id is required' });
      const { lat, lng } = req.body;
      if (lat == null || lng == null) {
        return res.status(400).json({ success: false, message: 'lat y lng son requeridos' });
      }
      const stop = await tripService.addStop(BigInt(idStr), lat, lng, req.user);
      res.status(201).json({ success: true, data: stop });
    } catch (error) { next(error); }
  },

  async endTrip(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id);
      if (!idStr) return res.status(400).json({ success: false, message: 'id is required' });
      const { lat, lng } = req.body;
      if (lat == null || lng == null) {
        return res.status(400).json({ success: false, message: 'lat y lng son requeridos' });
      }
      const trip = await tripService.endTrip(BigInt(idStr), lat, lng, req.user);
      res.json({ success: true, data: trip });
    } catch (error) { next(error); }
  },
};
