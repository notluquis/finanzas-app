import express from "express";
import { asyncHandler, authenticate, requireRole } from "../lib/http.js";
import { logEvent, logWarn, requestContext } from "../lib/logger.js";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings } from "../db.js";
import type { AuthenticatedRequest } from "../types.js";
import { settingsSchema } from "../schemas.js";

export function registerSettingsRoutes(app: express.Express) {
  app.get(
    "/api/settings",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const settings = await loadSettings();
      logEvent("settings:get", requestContext(req));
      res.json({ status: "ok", settings });
    })
  );

  app.put(
    "/api/settings",
    authenticate,
    requireRole("GOD", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      logEvent("settings:update:attempt", requestContext(req, { body: req.body }));
      const parsed = settingsSchema.safeParse(req.body);
      if (!parsed.success) {
        logWarn("settings:update:invalid", requestContext(req, { issues: parsed.error.issues }));
        return res
          .status(400)
          .json({ status: "error", message: "Los datos no son válidos", issues: parsed.error.issues });
      }

      const payload: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...parsed.data,
      };
      await saveSettings(payload);
      const settings = await loadSettings();
      logEvent("settings:update:success", requestContext(req));
      res.json({ status: "ok", settings });
    })
  );
}
