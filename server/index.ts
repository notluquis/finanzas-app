import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { ensureSchema } from "./db.js";
import { PORT } from "./config.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerTransactionRoutes } from "./routes/transactions.js";
import { registerBalanceRoutes } from "./routes/balances.js";
import { registerEmployeeRoutes } from "./routes/employees.js";
import { registerTimesheetRoutes } from "./routes/timesheets.js";
import { registerCounterpartRoutes } from "./routes/counterparts.js";
import suppliesRouter from "./routes/supplies.js";

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use((req, _res, next) => {
  console.log(`[req] ${req.method} ${req.originalUrl}`);
  next();
});

registerAuthRoutes(app);
registerSettingsRoutes(app);
registerTransactionRoutes(app);
registerBalanceRoutes(app);
registerEmployeeRoutes(app);
registerTimesheetRoutes(app);
registerCounterpartRoutes(app);
app.use("/api/supplies", suppliesRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const status = typeof err.statusCode === "number" ? err.statusCode : 500;
  res.status(status).json({
    status: "error",
    message: err.message || "Error inesperado en el servidor",
  });
});

ensureSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor API escuchando en http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("No se ha podido inicializar la base de datos:", error);
    process.exit(1);
  });
