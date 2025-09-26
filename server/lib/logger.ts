import type express from "express";
import type { AuthenticatedRequest } from "../types.js";

export function logEvent(tag: string, details: Record<string, unknown> = {}) {
  console.info(`[${new Date().toISOString()}] ${tag}`, details);
}

export function logWarn(tag: string, details: Record<string, unknown> = {}) {
  console.warn(`[${new Date().toISOString()}] ${tag}`, details);
}

export function requestContext(req: express.Request, extra: Record<string, unknown> = {}) {
  const auth = (req as AuthenticatedRequest).auth;
  return {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userId: auth?.userId ?? null,
    email: auth?.email ?? null,
    ...extra,
  };
}
