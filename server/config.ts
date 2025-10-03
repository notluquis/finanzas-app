import { config } from "dotenv";
import type { CookieOptions } from "express";

// Cargar variables de entorno
config({ debug: false });

export const isProduction = process.env.NODE_ENV === "production";

const rawJwtSecret = process.env.JWT_SECRET;
if (!rawJwtSecret) {
  throw new Error("Debes definir JWT_SECRET en tu archivo .env");
}

export const JWT_SECRET = rawJwtSecret;
export const PORT = Number(process.env.PORT ?? 4000);
export const sessionCookieName = "mp_session";
export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "lax" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};
