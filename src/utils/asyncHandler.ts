import type {
  NextFunction,
  ParamsDictionary,
  RequestHandler,
} from 'express-serve-static-core';

type AsyncController<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = unknown,
  LocalsObj extends Record<string, unknown> = Record<string, unknown>,
> = RequestHandler<P, ResBody, ReqBody, ReqQuery, LocalsObj>;

export const asyncHandler = <
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = unknown,
  LocalsObj extends Record<string, unknown> = Record<string, unknown>,
>(handler: AsyncController<P, ResBody, ReqBody, ReqQuery, LocalsObj>): RequestHandler<P, ResBody, ReqBody, ReqQuery, LocalsObj> => {
  return (req, res, next: NextFunction) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
};