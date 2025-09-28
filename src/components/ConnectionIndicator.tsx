import { useEffect, useMemo, useState } from "react";

interface HealthResponse {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  checks: {
    db: {
      status: "ok" | "error";
      latency: number | null;
      message?: string;
    };
  };
}

type IndicatorLevel = "online" | "degraded" | "offline";

type IndicatorState = {
  level: IndicatorLevel;
  fetchedAt: Date | null;
  message: string;
  details: string[];
};

const STATUS_COPY: Record<IndicatorLevel, { label: string; description: string }> = {
  online: {
    label: "Conectado",
    description: "API y base de datos respondiendo con normalidad.",
  },
  degraded: {
    label: "Conectado con alertas",
    description: "Seguimos comunicándonos con el servidor pero detectamos incidencias.",
  },
  offline: {
    label: "Sin conexión",
    description: "No pudimos contactar al servidor. Verifica el servicio." ,
  },
};

const INDICATOR_COLORS: Record<IndicatorLevel, string> = {
  online: "bg-emerald-400",
  degraded: "bg-amber-400",
  offline: "bg-rose-400",
};

export function ConnectionIndicator() {
  const [state, setState] = useState<IndicatorState>({
    level: "offline",
    fetchedAt: null,
    message: STATUS_COPY.offline.description,
    details: [],
  });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    async function fetchHealth() {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 5000);
      try {
        console.debug("[steps][health] Step 1: consultar /api/health");
        const res = await fetch("/api/health", {
          credentials: "include",
          signal: controller.signal,
        });
        const fetchedAt = new Date();
        console.debug("[steps][health] Step 2: respuesta /api/health", res.status);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const payload = (await res.json()) as HealthResponse;
        if (cancelled) return;

        console.debug("[steps][health] Step 3: payload health", payload.status);
        const details: string[] = [];
        if (payload.checks?.db) {
          const dbCheck = payload.checks.db;
          if (dbCheck.status === "error") {
            details.push(dbCheck.message ?? "No se pudo contactar la base de datos");
            console.warn("[steps][health] DB check falló", dbCheck.message);
          } else if (typeof dbCheck.latency === "number") {
            details.push(`Base de datos OK · ${dbCheck.latency} ms`);
            console.debug("[steps][health] DB latency", dbCheck.latency);
          } else {
            details.push("Base de datos OK");
          }
        }

        if (payload.status === "ok") {
          setState({
            level: "online",
            fetchedAt,
            message: STATUS_COPY.online.description,
            details,
          });
        } else if (payload.status === "degraded") {
          setState({
            level: "degraded",
            fetchedAt,
            message: STATUS_COPY.degraded.description,
            details,
          });
        } else {
          setState({
            level: "offline",
            fetchedAt,
            message: STATUS_COPY.offline.description,
            details,
          });
        }
      } catch (error) {
        if (cancelled) return;
        const fetchedAt = new Date();
        console.error("[steps][health] Step error: fallo en health", error);
        const detailMessage =
          error instanceof Error
            ? error.message === "The user aborted a request."
              ? "Conexión agotada (timeout)"
              : error.message
            : "Error desconocido";

        setState({
          level: "offline",
          fetchedAt,
          message: STATUS_COPY.offline.description,
          details: [detailMessage],
        });
      } finally {
        window.clearTimeout(timeoutId);
        console.debug("[steps][health] Step final: actualización completa");
      }
    }

    fetchHealth();
    intervalId = window.setInterval(fetchHealth, 30000);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!open || state.level === "online") return;
    const timer = window.setTimeout(() => setOpen(false), 8000);
    return () => window.clearTimeout(timer);
  }, [open, state.level]);

  const statusCopy = useMemo(() => STATUS_COPY[state.level], [state.level]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="glass-card flex items-center gap-2 rounded-full border border-white/60 bg-white/60 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-white/80 hover:bg-white/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(14,100,183,0.35)]"
        aria-pressed={open}
        aria-label={`Estado de la conexión: ${statusCopy.label}`}
      >
        <span
          className={`h-2.5 w-2.5 rounded-full shadow-inner transition ${INDICATOR_COLORS[state.level]} ${
            state.level === "offline" ? "animate-pulse" : ""
          }`}
        />
        <span className="hidden sm:inline">{statusCopy.label}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-30 w-72 text-sm">
          <div className="glass-card glass-underlay-gradient space-y-3 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">{statusCopy.label}</p>
                <p className="text-xs text-slate-500/90">{state.message}</p>
              </div>
              <span
                className={`h-3 w-3 rounded-full ${INDICATOR_COLORS[state.level]} shadow-inner`}
                aria-hidden="true"
              />
            </div>
            {state.details.length > 0 && (
              <ul className="space-y-1 text-xs text-slate-500">
                {state.details.map((detail, index) => (
                  <li key={index}>• {detail}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-between text-[11px] uppercase tracking-wide text-slate-400">
              <span>Servicio API</span>
              <span>
                {state.fetchedAt
                  ? `Hace ${Math.max(0, Math.round((Date.now() - state.fetchedAt.getTime()) / 1000))} s`
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConnectionIndicator;
