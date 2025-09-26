import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { fmtCLP } from "../lib/format";
import { formatRut } from "../lib/rut";
import { fetchParticipantLeaderboard } from "../features/participants/api";
import type { ParticipantSummaryRow } from "../features/participants/types";
import type { DbMovement } from "../features/transactions/types";

type StatsResponse = {
  status: "ok";
  monthly: Array<{ month: string; in: number; out: number; net: number }>;
  totals: Record<string, number>;
  byType: Array<{ description: string | null; direction: "IN" | "OUT" | "NEUTRO"; total: number }>;
};

type TransactionsResponse = {
  status: "ok" | "error";
  data: DbMovement[];
  message?: string;
};

const RANGE_DAYS = 30;

export default function Home() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [topParticipants, setTopParticipants] = useState<ParticipantSummaryRow[]>([]);
  const [participantsError, setParticipantsError] = useState<string | null>(null);
  const [recentMovements, setRecentMovements] = useState<DbMovement[]>([]);

  const from = useMemo(() => dayjs().subtract(RANGE_DAYS, "day").format("YYYY-MM-DD"), []);
  const to = useMemo(() => dayjs().format("YYYY-MM-DD"), []);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    await Promise.all([loadStats(), loadParticipants(), loadMovements()]);
  }

  async function loadStats() {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/transactions/stats?${params.toString()}`, { credentials: "include" });
      const payload = (await res.json()) as StatsResponse & { message?: string };
      if (!res.ok || payload.status !== "ok") {
        throw new Error(payload.message || "No se pudo cargar el resumen");
      }
      setStats(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al cargar el resumen";
      setStatsError(message);
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }

  async function loadParticipants() {
    setParticipantsError(null);
    try {
      const response = await fetchParticipantLeaderboard({ from, to, limit: 5, mode: "outgoing" });
      setTopParticipants(response.participants);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo obtener el ranking de retiros";
      setParticipantsError(message);
      setTopParticipants([]);
    }
  }

  async function loadMovements() {
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "5", includeAmounts: "true" });
      const res = await fetch(`/api/transactions?${params.toString()}`, { credentials: "include" });
      const payload = (await res.json()) as TransactionsResponse;
      if (!res.ok || payload.status !== "ok") {
        throw new Error(payload.message || "No se pudieron obtener los movimientos recientes");
      }
      setRecentMovements(payload.data);
    } catch (err) {
      setRecentMovements([]);
    }
  }

  const totals = useMemo(() => {
    if (!stats) return { in: 0, out: 0, net: 0 };
    const inTotal = stats.totals?.IN ?? 0;
    const outTotal = stats.totals?.OUT ?? 0;
    return {
      in: inTotal,
      out: outTotal,
      net: inTotal - outTotal,
    };
  }, [stats]);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Panel financiero</h1>
        <p className="text-sm text-slate-600">
          Resumen rápido de los últimos {RANGE_DAYS} días con accesos directos a tus vistas principales.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Ingresos" value={totals.in} accent="emerald" loading={statsLoading} />
        <MetricCard title="Egresos" value={totals.out} accent="rose" loading={statsLoading} />
        <MetricCard title="Neto" value={totals.net} accent={totals.net >= 0 ? "emerald" : "rose"} loading={statsLoading} />
      </section>

      {statsError && <p className="rounded-lg bg-rose-100 px-4 py-3 text-sm text-rose-700">{statsError}</p>}

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <DashboardChart data={stats?.monthly ?? []} loading={statsLoading} />
          <QuickActions />
        </div>
        <aside className="space-y-6">
          <TopParticipantsWidget data={topParticipants} loading={statsLoading} error={participantsError} />
          <RecentMovementsWidget rows={recentMovements} />
        </aside>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <ShortcutCard
          title="Subir movimientos"
          description="Carga los nuevos CSV de Mercado Pago y sincronízalos con la base de datos."
          to="/upload"
          accent="secondary"
        />
        <ShortcutCard
          title="Ver movimientos"
          description="Filtra y audita los movimientos guardados con el saldo calculado."
          to="/transactions/movements"
          accent="primary"
        />
        <ShortcutCard
          title="Panel de estadísticas"
          description="Explora tendencias, proporciones y retiros destacados con mayor detalle."
          to="/stats"
          accent="primary"
        />
      </section>
    </section>
  );
}

function MetricCard({
  title,
  value,
  accent,
  loading,
}: {
  title: string;
  value: number;
  accent: "emerald" | "rose" | "primary";
  loading: boolean;
}) {
  const colorClass =
    accent === "emerald"
      ? "bg-emerald-100 text-emerald-700"
      : accent === "rose"
        ? "bg-rose-100 text-rose-700"
        : "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]";

  return (
    <article className={`rounded-2xl p-6 shadow-sm ring-1 ring-black/5 ${colorClass}`}>
      <h2 className="text-sm font-semibold uppercase tracking-wide">{title}</h2>
      <p className="mt-2 text-2xl font-bold">{loading ? "—" : fmtCLP(value)}</p>
    </article>
  );
}

function DashboardChart({
  data,
  loading,
}: {
  data: Array<{ month: string; in: number; out: number; net: number }>;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--brand-primary)]/10 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Cargando actividad...
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="rounded-2xl border border-[var(--brand-primary)]/10 bg-white p-6 text-sm text-slate-500 shadow-sm">
        No se registran movimientos recientes.
      </div>
    );
  }

  const maxValue = Math.max(...data.map((row) => Math.max(row.in, row.out)));

  return (
    <article className="space-y-3 rounded-2xl border border-[var(--brand-primary)]/10 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[var(--brand-primary)]">Actividad de los últimos {RANGE_DAYS} días</h2>
        <span className="text-xs uppercase tracking-wide text-slate-400">Ingresos vs egresos</span>
      </div>
      <div className="flex items-end gap-4 overflow-x-auto pb-2">
        {data.map((row) => {
          const inHeight = maxValue ? Math.max((row.in / maxValue) * 140, 4) : 4;
          const outHeight = maxValue ? Math.max((row.out / maxValue) * 140, 4) : 4;
          return (
            <div key={row.month} className="flex min-w-[80px] flex-col items-center gap-2">
              <div className="flex h-40 w-full items-end gap-2">
                <div className="flex-1 rounded-t bg-emerald-500/80" style={{ height: `${inHeight}px` }} />
                <div className="flex-1 rounded-t bg-rose-500/80" style={{ height: `${outHeight}px` }} />
              </div>
              <span className="text-xs font-medium text-slate-600">{dayjs(row.month).format("MMM YY")}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function QuickActions() {
  return (
    <article className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-3">
      <QuickAction title="Subir CSV" description="Pasa nuevos movimientos a la base" to="/upload" />
      <QuickAction title="Registrar saldo" description="Actualiza saldos diarios" to="/transactions/balances" />
      <QuickAction title="Retiros" description="Consulta participantes y retiros" to="/transactions/participants" />
    </article>
  );
}

function QuickAction({ title, description, to }: { title: string; description: string; to: string }) {
  return (
    <Link
      to={to}
      className="flex h-full flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-600 transition hover:border-[var(--brand-primary)]/40 hover:bg-white"
    >
      <div>
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      <span className="mt-3 text-xs font-semibold text-[var(--brand-primary)]">Ir</span>
    </Link>
  );
}

function TopParticipantsWidget({
  data,
  loading,
  error,
}: {
  data: ParticipantSummaryRow[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <article className="space-y-3 rounded-2xl border border-[var(--brand-secondary)]/30 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--brand-secondary)]">Retiros destacados</h3>
        <Link to="/transactions/participants" className="text-xs font-semibold text-[var(--brand-secondary)]">
          Ver todos
        </Link>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {loading ? (
        <p className="text-xs text-slate-500">Cargando...</p>
      ) : data.length ? (
        <ul className="space-y-2 text-sm text-slate-600">
          {data.map((item) => {
            const displayName = item.bankAccountHolder || item.displayName || item.participant;
            const rut = item.identificationNumber ? formatRut(item.identificationNumber) || "-" : "-";
            const account = item.bankAccountNumber || item.withdrawId || "-";
            return (
              <li
                key={`${item.participant}-${item.withdrawId ?? ""}`}
                className="flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-slate-700">{displayName}</p>
                  <p className="text-xs text-slate-500">RUT {rut} · Cuenta {account}</p>
                  <p className="text-[10px] text-slate-400">{item.outgoingCount} retiros</p>
                </div>
                <span className="text-xs font-semibold text-slate-400">{fmtCLP(item.outgoingAmount)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">Aún no hay retiros registrados.</p>
      )}
    </article>
  );
}

function RecentMovementsWidget({ rows }: { rows: DbMovement[] }) {
  return (
    <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-700">Últimos movimientos</h3>
        <Link to="/transactions/movements" className="text-xs font-semibold text-[var(--brand-primary)]">
          Ver más
        </Link>
      </div>
      {rows.length ? (
        <ul className="space-y-3 text-xs text-slate-600">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-700">{row.description ?? row.source_id ?? "(sin descripción)"}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  {dayjs(row.timestamp).format("DD MMM YYYY HH:mm")}
                </p>
              </div>
              <span
                className={`text-xs font-semibold ${
                  row.direction === "IN" ? "text-emerald-600" : row.direction === "OUT" ? "text-rose-600" : "text-slate-500"
                }`}
              >
                {row.direction === "OUT" ? `-${fmtCLP(row.amount ?? 0)}` : fmtCLP(row.amount ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">Sin movimientos cargados aún.</p>
      )}
    </article>
  );
}

function ShortcutCard({
  title,
  description,
  to,
  accent,
}: {
  title: string;
  description: string;
  to: string;
  accent: "primary" | "secondary";
}) {
  const color = accent === "primary" ? "var(--brand-primary)" : "var(--brand-secondary)";

  return (
    <article className="flex flex-col justify-between rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div>
        <h2 className="text-lg font-semibold" style={{ color }}>
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
      </div>
      <Link
        to={to}
        className="mt-4 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow"
        style={{ backgroundColor: color }}
      >
        Abrir
      </Link>
    </article>
  );
}
