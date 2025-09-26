import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { logger } from "../lib/logger";
import {
  DailyBalancesPanel,
} from "../features/balances/components/DailyBalancesPanel";
import { BalanceSummary } from "../features/balances/components/BalanceSummary";
import type { BalancesApiResponse, BalanceDraft } from "../features/balances/types";
import {
  deriveInitialBalance,
  formatBalanceInput,
  parseBalanceInput,
} from "../features/balances/utils";

export default function DailyBalances() {
  const { hasRole } = useAuth();
  const { settings } = useSettings();
  const canEdit = hasRole("GOD", "ADMIN", "ANALYST");

  const [from, setFrom] = useState(dayjs().subtract(10, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [report, setReport] = useState<BalancesApiResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, BalanceDraft>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

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
    const match = quickMonths.find((month) => month.from === from && month.to === to);
    return match ? match.value : "custom";
  }, [quickMonths, from, to]);

  const loadBalances = useCallback(
    async (fromValue: string, toValue: string) => {
      setLoading(true);
      setSummaryLoading(true);
      setError(null);
      setSummaryError(null);
      try {
        logger.info("[balances] fetch:start", { from: fromValue, to: toValue });
        const params = new URLSearchParams({ from: fromValue, to: toValue });
        const res = await fetch(`/api/balances?${params.toString()}`, {
          credentials: "include",
        });
        const payload = (await res.json()) as BalancesApiResponse & { message?: string };
        if (!res.ok || payload.status !== "ok") {
          throw new Error(payload.message || "No se pudieron obtener los saldos diarios");
        }
        setReport(payload);
        const drafts: Record<string, BalanceDraft> = {};
        for (const day of payload.days) {
          drafts[day.date] = {
            value: day.recordedBalance != null ? formatBalanceInput(day.recordedBalance) : "",
            note: day.note ?? "",
          };
        }
        setDrafts(drafts);
        logger.info("[balances] fetch:success", { days: payload.days.length });
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudieron obtener los saldos diarios";
        setError(message);
        setSummaryError(message);
        setReport(null);
        setDrafts({});
        logger.error("[balances] fetch:error", message);
      } finally {
        setLoading(false);
        setSummaryLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadBalances(from, to);
  }, [from, to, loadBalances]);

  const handleDraftChange = useCallback((date: string, patch: Partial<BalanceDraft>) => {
    setDrafts((prev) => {
      const previous = prev[date] ?? { value: "", note: "" };
      return {
        ...prev,
        [date]: {
          value: patch.value ?? previous.value,
          note: patch.note ?? previous.note,
        },
      };
    });
  }, []);

  const handleSave = useCallback(
    async (date: string) => {
      if (!canEdit) return;
      const draft = drafts[date];
      if (!draft) return;

      const parsedValue = parseBalanceInput(draft.value);
      if (parsedValue == null) {
        setError("Ingresa un saldo válido antes de guardar");
        return;
      }

      setSaving((prev) => ({ ...prev, [date]: true }));
      setError(null);
      try {
        const res = await fetch("/api/balances", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            date,
            balance: parsedValue,
            note: draft.note.trim() ? draft.note.trim() : undefined,
          }),
        });
        const payload = (await res.json()) as { status: "ok" | "error"; message?: string };
        if (!res.ok || payload.status !== "ok") {
          throw new Error(payload.message || "No se pudo guardar el saldo diario");
        }
        await loadBalances(from, to);
        logger.info("[balances] save:success", { date, balance: parsedValue });
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudo guardar el saldo diario";
        setError(message);
        logger.error("[balances] save:error", message);
      } finally {
        setSaving((prev) => ({ ...prev, [date]: false }));
      }
    },
    [canEdit, drafts, from, to, loadBalances]
  );

  const derivedInitial = useMemo(() => (report ? deriveInitialBalance(report) : null), [report]);

  return (
    <section className="space-y-6">
      {!hasRole("GOD", "ADMIN", "ANALYST", "VIEWER") ? (
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-sm text-rose-600 shadow-sm">
          No tienes permisos para ver los saldos diarios.
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Saldos diarios</h1>
              <p className="max-w-2xl text-sm text-slate-600">
                Registra el saldo de la cuenta a las 23:59 de cada día para conciliar los movimientos
                almacenados en <code>mp_transactions</code>. Para consultas, escribe a
                <strong> {settings.supportEmail}</strong>.
              </p>
              {derivedInitial != null && (
                <p className="text-xs text-slate-500">
                  Saldo anterior calculado: <strong>{formatBalanceInput(derivedInitial)}</strong>
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Fecha desde
                <input
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="rounded border px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Fecha hasta
                <input
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="rounded border px-2 py-1"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Mes rápido
                <select
                  value={quickRange}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "custom") return;
                    const match = quickMonths.find((month) => month.value === value);
                    if (!match) return;
                    setFrom(match.from);
                    setTo(match.to);
                    loadBalances(match.from, match.to);
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
              <button
                type="button"
                onClick={() => loadBalances(from, to)}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed"
                style={{ backgroundColor: "var(--brand-primary)", opacity: loading ? 0.6 : 1 }}
              >
                {loading ? "Actualizando..." : "Actualizar"}
              </button>
            </div>
          </div>

          <BalanceSummary report={report} loading={summaryLoading} error={summaryError} />

          <DailyBalancesPanel
            report={report}
            drafts={drafts}
            onDraftChange={handleDraftChange}
            onSave={handleSave}
            saving={saving}
            loading={loading}
            error={error}
          />
        </>
      )}
    </section>
  );
}
