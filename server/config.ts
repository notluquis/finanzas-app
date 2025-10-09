import { config } from "dotenv";
import crypto from "crypto";
import type { CookieOptions } from "express";

// Cargar .env si existe
config({ debug: false });

export const isProduction = process.env.NODE_ENV === "production";

let rawJwtSecret = process.env.JWT_SECRET ?? "";

const MIN_HEX_LENGTH = 64; // 32 bytes -> 64 hex chars

if (!rawJwtSecret) {
  if (isProduction) {
    throw new Error(
      "Debes definir JWT_SECRET en las variables de entorno (no uses el placeholder de .env.example)."
    );
  } else {
    // Genera un secreto temporal para desarrollo (no válido para producción)
    rawJwtSecret = crypto.randomBytes(32).toString("hex");
    console.warn(
      "[config] JWT_SECRET no definido: se generó un secreto temporal para desarrollo (no válido para producción)."
    );
  }
}

if (isProduction && rawJwtSecret.length < MIN_HEX_LENGTH) {
  throw new Error(
    `JWT_SECRET definido pero es demasiado corto (longitud ${rawJwtSecret.length}). Se requieren al menos ${MIN_HEX_LENGTH} caracteres hex.`
  );
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
