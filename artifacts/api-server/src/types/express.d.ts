// Augmente le type Request d'Express avec le champ pose par requireAuth.ts.
declare namespace Express {
  export interface Request {
    userId?: string
  }
}
