import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";

export interface AuthPayload {
  sub: number;
  email: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as unknown as AuthPayload;
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ error: "Sesión inválida o expirada" });
  }
}
