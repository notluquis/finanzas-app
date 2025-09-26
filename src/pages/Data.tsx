import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { coerceAmount } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { logger } from "../lib/logger";
import { isCashbackCandidate } from "../../shared/cashback";
import { roundCurrency } from "../../shared/currency";
import {
  TransactionsFilters,
} from "../features/transactions/components/TransactionsFilters";
import {
  TransactionsColumnToggles,
} from "../features/transactions/components/TransactionsColumnToggles";
import { TransactionsTable } from "../features/transactions/components/TransactionsTable";
import { DailyBalancesPanel } from "../features/balances/components/DailyBalancesPanel";
import { COLUMN_DEFS, type ColumnKey } from "../features/transactions/constants";
import type {
  Filters,
  DbMovement,
  LedgerRow,
} from "../features/transactions/types";
import type { BalancesApiResponse, BalanceDraft } from "../features/balances/types";
import {
  deriveInitialBalance,
  formatBalanceInput,
  parseBalanceInput,
} from "../features/balances/utils";

const DEFAULT_PAGE_SIZE = 50;

type ApiResponse = {
  status: "ok" | "error";
  data: DbMovement[];
  hasAmounts?: boolean;
  total?: number;
  page?: number;
  pageSize?: number;
  message?: string;
};

export default function Data() {
  const [rows, setRows] = useState<DbMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialBalance, setInitialBalance] = useState<string>("0");
  const [initialBalanceEdited, setInitialBalanceEdited] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    from: dayjs().subtract(10, "day").format("YYYY-MM-DD"),
    to: dayjs().format("YYYY-MM-DD"),
    description: "",
    sourceId: "",
    origin: "",
    destination: "",
    direction: "",
    includeAmounts: false,
  });
  const [hasAmounts, setHasAmounts] = useState(false);
  const [balancesReport, setBalancesReport] = useState<BalancesApiResponse | null>(null);
  const [balancesDrafts, setBalancesDrafts] = useState<Record<string, BalanceDraft>>({});
  const [balancesSaving, setBalancesSaving] = useState<Record<string, boolean>>({});
  const [balancesError, setBalancesError] = useState<string | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    () => new Set(COLUMN_DEFS.map((column) => column.key))
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);

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
    const match = quickMonths.find(({ from: start, to: end }) => start === filters.from && end === filters.to);
    return match ? match.value : "custom";
  }, [quickMonths, filters.from, filters.to]);

  const { hasRole } = useAuth();
  const { settings } = useSettings();

  const canView = hasRole("GOD", "ADMIN", "ANALYST", "VIEWER");

  const initialBalanceNumber = useMemo(
    () => coerceAmount(initialBalance),
    [initialBalance]
  );

  useEffect(() => {
    if (canView) {
      refresh(filters, 1, pageSize);
    } else {
      setRows([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const ledger = useMemo<LedgerRow[]>(() => {
    let balance = initialBalanceNumber;
    const chronological = rows
      .slice()
      .sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1))
      .map((row) => {
        const amount = row.amount ?? 0;
        const delta = isCashbackCandidate(row)
          ? 0
          : row.direction === "IN"
            ? amount
            : row.direction === "OUT"
              ? -amount
              : 0;
        if (hasAmounts) {
          balance += delta;
        }
        return {
          ...row,
          runningBalance: hasAmounts ? balance : 0,
          delta,
        };
      });

    return chronological.reverse();
  }, [rows, initialBalanceNumber, hasAmounts]);

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
        const res = await fetch(`/api/balances?${params.toString()}`, {
          credentials: "include",
        });
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

  useEffect(() => {
    if (!balancesReport) {
      setBalancesDrafts({});
      return;
    }

    const drafts: Record<string, BalanceDraft> = {};
    for (const day of balancesReport.days) {
      drafts[day.date] = {
        value: day.recordedBalance != null ? formatBalanceInput(day.recordedBalance) : "",
        note: day.note ?? "",
      };
    }
    setBalancesDrafts(drafts);
  }, [balancesReport]);

  useEffect(() => {
    if (!balancesReport || initialBalanceEdited) {
      return;
    }

    const derived = deriveInitialBalance(balancesReport);
    if (derived == null) {
      const hasRecorded = balancesReport.days.some((day) => day.recordedBalance != null);
      if (!balancesReport.previous && !hasRecorded && initialBalance !== "0") {
        setInitialBalance("0");
      }
      return;
    }

    const formatted = formatBalanceInput(derived);
    if (formatted !== initialBalance) {
      setInitialBalance(formatted);
    }
  }, [balancesReport, initialBalance, initialBalanceEdited]);

  async function refresh(next: Filters, nextPage = page, nextPageSize = pageSize) {
    if (!canView) {
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      logger.info("[data] fetch:start", { filters: next, page: nextPage, pageSize: nextPageSize });
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("pageSize", String(nextPageSize));
      if (next.from) params.set("from", next.from);
      if (next.to) params.set("to", next.to);
        if (next.description) params.set("description", next.description);
        if (next.sourceId) params.set("sourceId", next.sourceId);
        if (next.origin) params.set("origin", next.origin);
      if (next.destination) params.set("destination", next.destination);
      if (next.direction) params.set("direction", next.direction);
        if (next.includeAmounts) params.set("includeAmounts", "true");

      const res = await fetch(`/api/transactions?${params.toString()}`, {
        credentials: "include",
      });
      const payload = (await res.json()) as ApiResponse;
      if (!res.ok || payload.status !== "ok") {
        throw new Error(payload.message || "No se pudieron obtener los movimientos");
      }
      setRows(payload.data);
      setHasAmounts(Boolean(payload.hasAmounts));
      setTotal(payload.total ?? payload.data.length);
      setPage(payload.page ?? nextPage);
      setPageSize(payload.pageSize ?? nextPageSize);
      await loadBalances(next.from, next.to);
      logger.info("[data] fetch:success", {
        rows: payload.data.length,
        hasAmounts: Boolean(payload.hasAmounts),
        total: payload.total,
        page: payload.page,
        pageSize: payload.pageSize,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado al cargar";
      setError(message);
      setRows([]);
      setHasAmounts(false);
      logger.error("[data] fetch:error", message);
    } finally {
      setLoading(false);
    }
  }

  const handleFilterChange = (update: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...update }));
    if (Object.prototype.hasOwnProperty.call(update, "from") || Object.prototype.hasOwnProperty.call(update, "to")) {
      setInitialBalanceEdited(false);
    }
  };

  const handleBalanceDraftChange = useCallback((date: string, patch: Partial<BalanceDraft>) => {
    setBalancesDrafts((prev) => {
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

  const handleBalanceSave = useCallback(
    async (date: string) => {
      const draft = balancesDrafts[date];
      if (!draft) return;

      const parsedValue = parseBalanceInput(draft.value);
      if (parsedValue == null) {
        setBalancesError("Ingresa un saldo válido antes de guardar");
        return;
      }

      setBalancesSaving((prev) => ({ ...prev, [date]: true }));
      setBalancesError(null);

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
        await loadBalances(filters.from, filters.to);
        setInitialBalanceEdited(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudo guardar el saldo diario";
        setBalancesError(message);
      } finally {
        setBalancesSaving((prev) => ({ ...prev, [date]: false }));
      }
    },
    [balancesDrafts, filters.from, filters.to, loadBalances]
  );

  const handleResetInitialBalance = useCallback(() => {
    if (!balancesReport) return;
    const derived = deriveInitialBalance(balancesReport);
    if (derived == null) return;
    const formatted = formatBalanceInput(derived);
    setInitialBalance(formatted);
    setInitialBalanceEdited(false);
  }, [balancesReport]);

  return (
    <section className="space-y-6">
      {!canView ? (
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-sm text-rose-600 shadow-sm">
          No tienes permisos para ver los movimientos almacenados.
        </div>
      ) : (
        <>
          <TransactionsFilters
            filters={filters}
            loading={loading}
            onChange={handleFilterChange}
            onSubmit={() => {
              setPage(1);
              refresh(filters, 1, pageSize);
            }}
          />

          <TransactionsColumnToggles
            visibleColumns={visibleColumns}
            onToggle={(column) => {
              setVisibleColumns((prev) => {
                const next = new Set(prev);
                if (next.has(column)) next.delete(column);
                else next.add(column);
                return next;
              });
            }}
          />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Movimientos en la base</h1>
              <p className="max-w-2xl text-sm text-slate-600">
                Los datos provienen de la tabla <code>mp_transactions</code>. Ajusta el saldo inicial
                para recalcular el saldo acumulado. Para consultas o soporte, escribe a
                <strong> {settings.supportEmail}</strong>.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Saldo inicial (CLP)
                <input
                  type="text"
                  value={initialBalance}
                  onChange={(event) => {
                    setInitialBalanceEdited(true);
                    setInitialBalance(event.target.value);
                  }}
                  className="rounded border px-3 py-2 text-sm"
                  placeholder="0"
                />
              </label>
              <button
                type="button"
                onClick={handleResetInitialBalance}
                disabled={!balancesReport || balancesLoading}
                className="self-end rounded border border-[var(--brand-primary)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--brand-primary)] disabled:opacity-50"
              >
                Usar saldo diario
              </button>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Mes rápido
                <select
                  value={quickRange}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "custom") return;
                    const match = quickMonths.find((month) => month.value === value);
                    if (!match) return;
                    const nextFilters = { ...filters, from: match.from, to: match.to };
                    setFilters(nextFilters);
                    setInitialBalanceEdited(false);
                    setPage(1);
                    refresh(nextFilters, 1, pageSize);
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
                onClick={() => refresh(filters, page, pageSize)}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed"
                style={{ backgroundColor: "var(--brand-primary)", opacity: loading ? 0.6 : 1 }}
              >
                {loading ? "Actualizando..." : "Actualizar"}
              </button>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={filters.includeAmounts}
                  onChange={(event) => {
                    const nextFilters = { ...filters, includeAmounts: event.target.checked };
                    setFilters(nextFilters);
                    logger.info("[data] toggle includeAmounts", nextFilters.includeAmounts);
                    refresh(nextFilters, page, pageSize);
                  }}
                />
                Mostrar montos
              </label>
            </div>
          </div>

          <DailyBalancesPanel
            report={balancesReport}
            drafts={balancesDrafts}
            onDraftChange={handleBalanceDraftChange}
            onSave={handleBalanceSave}
            saving={balancesSaving}
            loading={balancesLoading}
            error={balancesError}
          />

          {error && <p className="rounded-lg bg-rose-100 px-4 py-3 text-sm text-rose-700">{error}</p>}

          <TransactionsTable
            rows={ledger}
            loading={loading}
            hasAmounts={hasAmounts}
            visibleColumns={visibleColumns}
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              refresh(filters, nextPage, pageSize);
            }}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
              refresh(filters, 1, nextPageSize);
            }}
          />
        </>
      )}
    </section>
  );
}
