// src/modules/trips/controller.ts

import { Request, Response, NextFunction } from 'express';
import { tripService } from './service';
import { CreateTripDto, UpdateTripDto } from './types';

function _paramToString(param: string | string[] | undefined): string | undefined {
  if (param === undefined) return undefined;
  return Array.isArray(param) ? param[0] : param;
}

export const tripController = {

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const trips = await tripService.getAll();
      res.json({ success: true, data: trips });
    } catch (error) { next(error); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id);
      if (!idStr) return res.status(400).json({ success: false, message: 'id is required' });
      const trip = await tripService.getById(BigInt(idStr));
      if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });
      res.json({ success: true, data: trip });
    } catch (error) { next(error); }
  },

  async getByClient(req: Request, res: Response, next: NextFunction) {
    try {
      const clientIdStr = _paramToString(req.params.clientId);
      if (!clientIdStr) return res.status(400).json({ success: false, message: 'clientId is required' });
      const trips = await tripService.getByClient(BigInt(clientIdStr));
      res.json({ success: true, data: trips });
    } catch (error) { next(error); }
  },

  async getByDateRange(req: Request, res: Response, next: NextFunction) {
    try {
      const { from, to } = req.query as { from: string; to: string };
      const clientIdStr = _paramToString(req.params.clientId);
      if (!clientIdStr) return res.status(400).json({ success: false, message: 'clientId is required' });
      const clientId = BigInt(clientIdStr);

      if (!from || !to) {
        return res.status(400).json({ success: false, message: 'from y to son requeridos' });
      }

      const trips = await tripService.getByDateRange(clientId, new Date(from), new Date(to));
      res.json({ success: true, data: trips });
    } catch (error) { next(error); }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const trip = await tripService.create(req.body as CreateTripDto);
      res.status(201).json({ success: true, data: trip });
    } catch (error) { next(error); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id);
      if (!idStr) return res.status(400).json({ success: false, message: 'id is required' });
      const trip = await tripService.update(BigInt(idStr), req.body as UpdateTripDto);
      res.json({ success: true, data: trip });
    } catch (error) { next(error); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const idStr = _paramToString(req.params.id);
      if (!idStr) return res.status(400).json({ success: false, message: 'id is required' });
      await tripService.delete(BigInt(idStr));
      res.status(204).send();
    } catch (error) { next(error); }
  },
};