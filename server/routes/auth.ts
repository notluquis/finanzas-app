import express from "express";
import bcrypt from "bcryptjs";
import {
  asyncHandler,
  authenticate,
  issueToken,
  sanitizeUser,
} from "../lib/http.js";
import { logEvent, logWarn, requestContext } from "../lib/logger.js";
import { sessionCookieName, sessionCookieOptions } from "../config.js";
import { findUserByEmail, findUserById } from "../db.js";
import type { AuthenticatedRequest } from "../types.js";
import { loginSchema } from "../schemas.js";

export function registerAuthRoutes(app: express.Express) {
  app.post(
    "/api/auth/login",
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      logEvent(
        "auth/login:attempt",
        requestContext(req, { body: req.body ? { ...req.body, password: "***" } : undefined })
      );
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        logWarn("auth/login:invalid-payload", requestContext(req, { issues: parsed.error.issues }));
        return res.status(400).json({ status: "error", message: "Credenciales no válidas" });
      }

      const { email, password } = parsed.data;
      const user = await findUserByEmail(email);
      if (!user) {
        logWarn("auth/login:unknown-user", requestContext(req, { email }));
        return res.status(401).json({ status: "error", message: "El correo o la contraseña no son correctos" });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        logWarn("auth/login:bad-password", requestContext(req, { email }));
        return res.status(401).json({ status: "error", message: "El correo o la contraseña no son correctos" });
      }

      const token = issueToken({ userId: user.id, email: user.email, role: user.role });
      res.cookie(sessionCookieName, token, sessionCookieOptions);

      logEvent("auth/login:success", requestContext(req, { userId: user.id, email: user.email }));
      res.json({
        status: "ok",
        user: sanitizeUser(user),
      });
    })
  );

  app.post(
    "/api/auth/logout",
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      logEvent("auth/logout", requestContext(req));
      res.clearCookie(sessionCookieName, { ...sessionCookieOptions, maxAge: undefined });
      res.json({ status: "ok" });
    })
  );

  app.get(
    "/api/auth/me",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      if (!req.auth) {
        logWarn("auth/me:missing-session", requestContext(req));
        return res.status(401).json({ status: "error", message: "La sesión no es válida" });
      }

      const user = await findUserById(req.auth.userId);
      if (!user) {
        logWarn("auth/me:stale-session", requestContext(req));
        res.clearCookie(sessionCookieName, { ...sessionCookieOptions, maxAge: undefined });
        return res.status(401).json({ status: "error", message: "La sesión ha expirado" });
      }

      res.json({ status: "ok", user: sanitizeUser(user) });
    })
  );
}