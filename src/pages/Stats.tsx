import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useAuth } from "../context/AuthContext";
import { fmtCLP } from "../lib/format";
import { formatRut } from "../lib/rut";
import { BalanceSummary } from "../features/balances/components/BalanceSummary";
import type { BalancesApiResponse } from "../features/balances/types";
import { fetchParticipantLeaderboard } from "../features/participants/api";
import type { ParticipantSummaryRow } from "../features/participants/types";

type StatsResponse = {
  status: "ok";
  monthly: Array<{ month: string; in: number; out: number; net: number }>;
  totals: Record<string, number>;
  byType: Array<{ description: string | null; direction: "IN" | "OUT" | "NEUTRO"; total: number }>;
};

const directionsLabels: Record<string, string> = {
  IN: "Ingresos",
  OUT: "Egresos",
  NEUTRO: "Neutros",
};

export default function Stats() {
  const { hasRole } = useAuth();
  const [from, setFrom] = useState(
    dayjs().subtract(3, "month").startOf("month").format("YYYY-MM-DD")
  );
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [balancesReport, setBalancesReport] = useState<BalancesApiResponse | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesError, setBalancesError] = useState<string | null>(null);
  const [topParticipants, setTopParticipants] = useState<ParticipantSummaryRow[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState<string | null>(null);

  const canView = hasRole("GOD", "ADMIN", "ANALYST", "VIEWER");

  const quickMonths = useMemo(() => {
    const months: Array<{ value: string; label: string; from: string; to: string }> = [];
    for (let i = 0; i < 12; i++) {
      const date = dayjs().subtract(i, "month").startOf("month");
      const label = date.format("MMMM YYYY");
      const start = date.format("YYYY-MM-DD");
      const end = date.endOf("month").format("YYYY-MM-DD");
      months.push({ value: start, label, from: start, to: end });
    }
    return months;
  }, []);

  const quickRange = useMemo(() => {
    const match = quickMonths.find(({ from: start, to: end }) => start === from && end === to);
    return match ? match.value : "custom";
  }, [quickMonths, from, to]);

  useEffect(() => {
    if (!canView) return;
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const totals = useMemo(() => {
    if (!data) return { in: 0, out: 0, net: 0 };
    const inTotal = data.totals?.IN ?? 0;
    const outTotal = data.totals?.OUT ?? 0;
    return {
      in: inTotal,
      out: outTotal,
      net: inTotal - outTotal,
    };
  }, [data]);

  const loadBalances = useCallback(
    async (fromValue: string, toValue: string) => {
      if (!fromValue || !toValue) {
        setBalancesReport(null);
        return;
      }

      setBalancesLoading(true);
      setBalancesError(null);
      try {
        const params = new URLSearchParams({ from: fromValue, to: toValue });
        const res = await fetch(`/api/balances?${params.toString()}`, { credentials: "include" });
        const payload = (await res.json()) as BalancesApiResponse & { message?: string };
        if (!res.ok || payload.status !== "ok") {
          throw new Error(payload.message || "No se pudieron obtener los saldos diarios");
        }
        setBalancesReport(payload);
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudieron obtener los saldos diarios";
        setBalancesError(message);
        setBalancesReport(null);
      } finally {
        setBalancesLoading(false);
      }
    },
    []
  );

  async function fetchStats() {
    await fetchStatsWithRange(from, to);
  }

  async function fetchStatsWithRange(fromValue: string, toValue: string) {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (fromValue) params.set("from", fromValue);
      if (toValue) params.set("to", toValue);
      const res = await fetch(`/api/transactions/stats?${params.toString()}`, { credentials: "include" });
      const payload = (await res.json()) as StatsResponse & { message?: string };
      if (!res.ok || payload.status !== "ok") {
        throw new Error(payload.message || "No se pudieron obtener las estadísticas");
      }
      setData(payload);
      await Promise.all([loadBalances(fromValue, toValue), loadLeaderboard(fromValue, toValue)]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado";
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadLeaderboard(fromValue: string, toValue: string) {
    setParticipantsLoading(true);
    setParticipantsError(null);
    try {
      const params: { limit: number; mode: "outgoing" | "combined"; from?: string; to?: string } = {
        limit: 5,
        mode: "outgoing",
      };
      if (fromValue) params.from = fromValue;
      if (toValue) params.to = toValue;
      const response = await fetchParticipantLeaderboard(params);
      setTopParticipants(response.participants);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron obtener los retiros principales";
      setParticipantsError(message);
      setTopParticipants([]);
    } finally {
      setParticipantsLoading(false);
    }
  }

  if (!canView) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Estadísticas</h1>
        <p className="rounded-2xl border border-rose-200 bg-white p-6 text-sm text-rose-600 shadow-sm">
          No tienes permisos para ver las estadísticas.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Estadísticas financieras</h1>
        <p className="text-sm text-slate-600">
          Resumen contable por mes, tipo de movimiento y direcciones. Ajusta el rango de fechas para
          analizar tendencias.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          fetchStats();
        }}
        className="grid gap-4 rounded-2xl border border-[var(--brand-primary)]/10 bg-white p-6 text-xs text-slate-600 shadow-sm sm:grid-cols-5"
      >
        <label className="flex flex-col gap-2">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Desde</span>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Hasta</span>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col gap-2">
          <span className="font-semibold uppercase tracking-wide text-slate-500">Intervalo rápido</span>
          <select
            value={quickRange}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "custom") return;
              const match = quickMonths.find((month) => month.value === value);
              if (!match) return;
              setFrom(match.from);
              setTo(match.to);
              fetchStatsWithRange(match.from, match.to);
            }}
            className="rounded border px-2 py-1"
          >
            <option value="custom">Personalizado</option>
            {quickMonths.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed"
          >
            {loading ? "Calculando..." : "Actualizar"}
          </button>
        </div>
      </form>

      {error && <p className="rounded-lg bg-rose-100 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {data && (
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Ingresos" value={totals.in} accent="emerald" />
            <StatCard title="Egresos" value={totals.out} accent="rose" />
            <StatCard title="Resultado neto" value={totals.net} accent={totals.net >= 0 ? "emerald" : "rose"} />
          </section>

          <MonthlyFlowChart data={data.monthly} />

          <BalanceSummary
            report={balancesReport}
            loading={balancesLoading}
            error={balancesError}
          />

          <section className="space-y-3 rounded-2xl border border-[var(--brand-secondary)]/20 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--brand-secondary)]">Por tipo de movimiento</h2>
            <MovementTypeList data={data.byType} />
          </section>

          <TopParticipantsSection
            data={topParticipants}
            loading={participantsLoading}
            error={participantsError}
          />
        </div>
      )}

      {!loading && !error && data && !data.monthly.length && (
        <p className="rounded-lg bg-amber-100 px-4 py-3 text-sm text-amber-700">
          No se encontraron movimientos en el rango seleccionado.
        </p>
      )}
    </section>
  );
}

function StatCard({
  title,
  value,
  accent,
}: {
  title: string;
  value: number;
  accent: "emerald" | "rose" | "slate" | string;
}) {
  const colorClass =
    accent === "emerald"
      ? "bg-emerald-100 text-emerald-700"
      : accent === "rose"
        ? "bg-rose-100 text-rose-700"
        : "bg-slate-100 text-slate-700";

  return (
    <div className={`rounded-2xl p-6 shadow-sm ${colorClass}`}>
      <h3 className="text-sm font-semibold uppercase tracking-wide">{title}</h3>
      <p className="mt-2 text-2xl font-bold">{fmtCLP(value)}</p>
    </div>
  );
}

function MonthlyFlowChart({
  data,
}: {
  data: Array<{ month: string; in: number; out: number; net: number }>;
}) {
  if (!data.length) return null;
  const maxValue = Math.max(...data.map((row) => Math.max(row.in, row.out)));
  return (
    <section className="space-y-3 rounded-2xl border border-[var(--brand-primary)]/10 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[var(--brand-primary)]">Flujo mensual</h2>
        <p className="text-xs text-slate-500">Ingresos vs egresos por mes</p>
      </div>
      <div className="flex items-end gap-4 overflow-x-auto pb-2">
        {data.map((row) => {
          const inHeight = maxValue ? Math.max((row.in / maxValue) * 140, 4) : 4;
          const outHeight = maxValue ? Math.max((row.out / maxValue) * 140, 4) : 4;
          return (
            <div key={row.month} className="flex min-w-[80px] flex-col items-center gap-2">
              <div className="flex h-40 w-full items-end gap-2">
                <div
                  title={`Ingresos ${fmtCLP(row.in)}`}
                  className="flex-1 rounded-t bg-emerald-500/80"
                  style={{ height: `${inHeight}px` }}
                />
                <div
                  title={`Egresos ${fmtCLP(row.out)}`}
                  className="flex-1 rounded-t bg-rose-500/80"
                  style={{ height: `${outHeight}px` }}
                />
              </div>
              <div className="text-center text-xs font-medium text-slate-600">
                {dayjs(row.month).format("MMM YY")}
              </div>
              <div
                className={`text-xs font-semibold ${row.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}
              >
                {row.net >= 0 ? fmtCLP(row.net) : `-${fmtCLP(Math.abs(row.net))}`}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MovementTypeList({
  data,
}: {
  data: Array<{ description: string | null; direction: "IN" | "OUT" | "NEUTRO"; total: number }>;
}) {
  if (!data.length) {
    return <p className="text-xs text-slate-500">Sin movimientos en el rango.</p>;
  }

  const sorted = [...data].sort((a, b) => b.total - a.total);
  const max = Math.max(...sorted.map((item) => Math.abs(item.total)));

  return (
    <div className="space-y-3">
      {sorted.map((row, index) => {
        const width = max ? Math.min((Math.abs(row.total) / max) * 100, 100) : 0;
        const colorClass =
          row.direction === "IN"
            ? "bg-emerald-500/70"
            : row.direction === "OUT"
              ? "bg-rose-500/70"
              : "bg-slate-400";
        return (
          <div key={`${row.description ?? "(sin descripción)"}-${index}`} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium text-slate-700">{row.description ?? "(sin descripción)"}</span>
              <span>{row.direction === "OUT" ? `-${fmtCLP(row.total)}` : fmtCLP(row.total)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full ${colorClass}`} style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TopParticipantsSection({
  data,
  loading,
  error,
}: {
  data: ParticipantSummaryRow[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-[var(--brand-primary)]/10 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-[var(--brand-primary)]">Top retiros</h2>
        <span className="text-xs uppercase tracking-wide text-slate-400">Mayores egresos</span>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {loading ? (
        <p className="text-xs text-slate-500">Cargando contrapartes...</p>
      ) : data.length ? (
        <ul className="space-y-2 text-sm text-slate-600">
          {data.map((item) => {
            const displayName = item.bankAccountHolder || item.displayName || item.participant;
            const rut = item.identificationNumber ? formatRut(item.identificationNumber) || "-" : "-";
            const account = item.bankAccountNumber || item.withdrawId || "-";
            return (
              <li
                key={`${item.participant}-${item.withdrawId ?? ""}`}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-slate-700">{displayName}</p>
                  <p className="text-xs text-slate-500">
                    RUT {rut} · Cuenta {account}
                  </p>
                  <p className="text-xs text-slate-400">
                    {item.outgoingCount} egresos · {fmtCLP(item.outgoingAmount)}
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  Total {fmtCLP(item.totalAmount)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">Sin retiros registrados en el rango.</p>
      )}
    </section>
  );
}
