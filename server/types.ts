import type express from "express";
import type { UserRole } from "./db.js";

export type AuthSession = {
  userId: number;
  email: string;
  role: UserRole;
};

export type AuthenticatedRequest = express.Request & { auth?: AuthSession };
