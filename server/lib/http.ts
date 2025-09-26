import type express from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "../db.js";
import { isRoleAtLeast } from "../db.js";
import { JWT_SECRET, sessionCookieName, sessionCookieOptions } from "../config.js";
import type { AuthenticatedRequest, AuthSession } from "../types.js";

export type AsyncHandler = (
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
) => Promise<unknown>;

export function asyncHandler(handler: AsyncHandler) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    handler(req as AuthenticatedRequest, res, next).catch(next);
  };
}

export function issueToken(session: AuthSession) {
  return jwt.sign(
    {
      sub: session.userId.toString(),
      email: session.email,
      role: session.role,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

export function sanitizeUser(user: { id: number; email: string; role: UserRole }) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
}

export function authenticate(
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
) {
  const token = req.cookies?.[sessionCookieName];
  if (!token) {
    return res.status(401).json({ status: "error", message: "No autorizado" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (!decoded || typeof decoded.sub !== "string") {
      throw new Error("Token inválido");
    }

    req.auth = {
      userId: Number(decoded.sub),
      email: String(decoded.email),
      role: (decoded.role as UserRole) ?? "VIEWER",
    };
    next();
  } catch (error) {
    res.clearCookie(sessionCookieName, { ...sessionCookieOptions, maxAge: undefined });
    return res.status(401).json({ status: "error", message: "Sesión expirada" });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ status: "error", message: "No autorizado" });
    }
    if (!isRoleAtLeast(req.auth.role, roles)) {
      return res.status(403).json({ status: "error", message: "Permisos insuficientes" });
    }
    next();
  };
}
