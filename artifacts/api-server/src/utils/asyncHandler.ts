import type { NextFunction, Request, Response } from 'express'

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>

// Evite un try/catch repete dans chaque controleur : toute rejection de
// promesse est transmise a `next()`, donc traitee par errorHandler.ts.
export function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next)
  }
}
