import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { AppError } from './AppError';
import { asyncHandler } from './asyncHandler';

export type CrudModelName = 'usuario' | 'cliente' | 'recorrido' | 'parada' | 'tarifa' | 'viaje';

export interface CrudService<CreateData = Record<string, unknown>, UpdateData = CreateData> {
  list: () => Promise<unknown[]>;
  getById: (id: string) => Promise<unknown>;
  create: (data: CreateData) => Promise<unknown>;
  update: (id: string, data: UpdateData) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
}

type ModelDelegate = {
  findMany: (args?: Record<string, unknown>) => Promise<unknown[]>;
  findUnique: (args: Record<string, unknown>) => Promise<unknown | null>;
  create: (args: Record<string, unknown>) => Promise<unknown>;
  update: (args: Record<string, unknown>) => Promise<unknown>;
  delete: (args: Record<string, unknown>) => Promise<unknown>;
};

type PrismaClientWithModels = typeof prisma & Record<CrudModelName, ModelDelegate>;

const getModel = (modelName: CrudModelName): ModelDelegate => {
  return (prisma as PrismaClientWithModels)[modelName];
};

const normalizeId = (id: string): string | number => {
  const numericId = Number(id);
  return Number.isNaN(numericId) ? id : numericId;
};

export const createCrudService = (modelName: CrudModelName): CrudService => {
  const model = () => getModel(modelName);

  return {
    list: async () => model().findMany(),
    getById: async (id) => {
      const record = await model().findUnique({ where: { id: normalizeId(id) } });

      if (!record) {
        throw new AppError(`${modelName} not found`, 404);
      }

      return record;
    },
    create: async (data) => model().create({ data: data as Record<string, unknown> }),
    update: async (id, data) => model().update({ where: { id: normalizeId(id) }, data: data as Record<string, unknown> }),
    remove: async (id) => model().delete({ where: { id: normalizeId(id) } }),
  };
};

export const createCrudController = <CreateData = Record<string, unknown>, UpdateData = CreateData>(service: CrudService<CreateData, UpdateData>) => {
  const list = asyncHandler(async (_req: Request, res: Response, _next: NextFunction) => {
    const items = await service.list();
    res.status(200).json({ success: true, data: items });
  });

  const getById = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const item = await service.getById(req.params.id);
    res.status(200).json({ success: true, data: item });
  });

  const create = asyncHandler(async (req: Request, res: Response) => {
    const item = await service.create(req.body as CreateData);
    res.status(201).json({ success: true, data: item });
  });

  const update = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const item = await service.update(req.params.id, req.body as UpdateData);
    res.status(200).json({ success: true, data: item });
  });

  const remove = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    await service.remove(req.params.id);
    res.status(200).json({ success: true, message: 'Deleted successfully' });
  });

  return {
    list,
    getById,
    create,
    update,
    remove,
  };
};