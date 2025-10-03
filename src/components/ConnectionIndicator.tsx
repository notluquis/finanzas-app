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

type IndicatorLevel = "online" | "degraded" | "offline" | "starting";

type IndicatorState = {
  level: IndicatorLevel;
  fetchedAt: Date | null;
  message: string;
  details: string[];
  retryCount: number;
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
    description: "No pudimos contactar al servidor. Verifica el servicio.",
  },
  starting: {
    label: "Servidor iniciando...",
    description: "El servidor está arrancando. Esto puede tomar unos momentos.",
  },
};

const INDICATOR_COLORS: Record<IndicatorLevel, string> = {
  online: "bg-emerald-400",
  degraded: "bg-amber-400",
  offline: "bg-rose-400",
  starting: "bg-blue-400 animate-pulse",
};

export function ConnectionIndicator() {
  const [state, setState] = useState<IndicatorState>({
    level: "starting",
    fetchedAt: null,
    message: STATUS_COPY.starting.description,
    details: ["Intentando conectar al servidor..."],
    retryCount: 0,
  });
  const [open, setOpen] = useState(false);
  const [hasConnectedOnce, setHasConnectedOnce] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    async function fetchHealth() {
      const controller = new AbortController();
      const requestTimeoutId = window.setTimeout(() => controller.abort(), 5000);
      
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
        
        // Marcar que hemos conectado al menos una vez
        if (!hasConnectedOnce) {
          setHasConnectedOnce(true);
          console.log("\u2705 Servidor conectado exitosamente");
        }
        
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
            retryCount: 0,
          });
        } else if (payload.status === "degraded") {
          setState({
            level: "degraded",
            fetchedAt,
            message: STATUS_COPY.degraded.description,
            details,
            retryCount: 0,
          });
        } else {
          setState({
            level: "offline",
            fetchedAt,
            message: STATUS_COPY.offline.description,
            details,
            retryCount: 0,
          });
        }
      } catch (error) {
        if (cancelled) return;
        
        const fetchedAt = new Date();
        console.error("[steps][health] Step error: fallo en health", error);
        
        setState(prevState => {
          const newRetryCount = prevState.retryCount + 1;
          const isStarting = !hasConnectedOnce && newRetryCount < 4; // Reducido a 20 segundos
          
          const detailMessage =
            error instanceof Error
              ? error.message === "The user aborted a request."
                ? "Conexión agotada (timeout)"
                : error.message
              : "Error desconocido";

          return {
            level: isStarting ? "starting" : "offline",
            fetchedAt,
            message: isStarting ? STATUS_COPY.starting.description : STATUS_COPY.offline.description,
            details: isStarting 
              ? [`Intento ${newRetryCount}/4: ${detailMessage}`]
              : [detailMessage],
            retryCount: newRetryCount,
          };
        });
        
        // Solo mostrar si es un error persistente después de varios intentos
        if (!hasConnectedOnce && state.retryCount > 2) {
          setOpen(true);
        }
      } finally {
        window.clearTimeout(requestTimeoutId);
        console.debug("[steps][health] Step final: actualización completa");
      }
    }

    fetchHealth();
    intervalId = window.setInterval(fetchHealth, 5000);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [hasConnectedOnce, state.retryCount]);

  // Auto-cerrar después de un tiempo si no está online
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
          className={`h-2.5 w-2.5 rounded-full shadow-inner transition ${INDICATOR_COLORS[state.level]}`}
        />
        <span className="hidden sm:inline">{statusCopy.label}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 text-sm">
          <div className="glass-card glass-underlay-gradient space-y-3 rounded-2xl p-4 shadow-xl border border-white/20">
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
            {state.level === "starting" && (
              <div className="rounded-lg bg-blue-50 p-2 text-xs text-blue-700">
                💡 El servidor puede tardar 10-20 segundos en inicializar.
              </div>
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
