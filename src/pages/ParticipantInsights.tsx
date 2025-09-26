import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { fmtCLP } from "../lib/format";
import { formatRut } from "../lib/rut";
import { fetchParticipantInsight, fetchParticipantLeaderboard } from "../features/participants/api";
import type {
  ParticipantCounterpartRow,
  ParticipantMonthlyRow,
  ParticipantSummaryRow,
} from "../features/participants/types";

const MAX_MONTHS = 12;

type RangeParams = {
  from?: string;
  to?: string;
};

function resolveRange(quickValue: string, fromValue: string, toValue: string): RangeParams {
  if (quickValue === "custom") {
    const range: RangeParams = {};
    if (fromValue) range.from = fromValue;
    if (toValue) range.to = toValue;
    return range;
  }

  const value = quickValue === "current" ? dayjs().format("YYYY-MM") : quickValue;
  const [yearStr, monthStr] = value.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return {};
  }

  const start = dayjs(new Date(year, monthIndex, 1));
  const end = start.endOf("month");

  return {
    from: start.format("YYYY-MM-DD"),
    to: end.format("YYYY-MM-DD"),
  };
}

type LeaderboardDisplayRow = {
  key: string;
  displayName: string;
  rut: string;
  account: string;
  outgoingCount: number;
  outgoingAmount: number;
  selectKey: string;
};

export default function ParticipantInsightsPage() {
  const [participantId, setParticipantId] = useState("123861706983");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [quickMonth, setQuickMonth] = useState("current");
  const [monthly, setMonthly] = useState<ParticipantMonthlyRow[]>([]);
  const [counterparts, setCounterparts] = useState<ParticipantCounterpartRow[]>([]);
  const [visible, setVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [leaderboard, setLeaderboard] = useState<ParticipantSummaryRow[]>([]);
  const [leaderboardLimit, setLeaderboardLimit] = useState(10);
  const [leaderboardGrouping, setLeaderboardGrouping] = useState<"account" | "rut">("account");
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<RangeParams>(() => resolveRange("current", "", ""));
  const activeParticipantId = participantId.trim();

  const accountRows = useMemo<LeaderboardDisplayRow[]>(() => {
    return leaderboard.map((row) => {
      const selectKey =
        row.participant ||
        row.bankAccountNumber ||
        row.withdrawId ||
        row.identificationNumber ||
        "";
      const displayName =
        row.bankAccountHolder || row.displayName || row.participant || "(sin información)";
      const rut = row.identificationNumber ? formatRut(row.identificationNumber) || "-" : "-";
      const account = row.bankAccountNumber || row.withdrawId || row.participant || "-";
      return {
        key: selectKey || `${displayName}-${account}`,
        displayName,
        rut,
        account,
        outgoingCount: row.outgoingCount,
        outgoingAmount: row.outgoingAmount,
        selectKey,
      };
    });
  }, [leaderboard]);

  const rutRows = useMemo<LeaderboardDisplayRow[]>(() => {
    const map = new Map<
      string,
      {
        displayName: string;
        rut: string;
        accounts: Set<string>;
        outgoingCount: number;
        outgoingAmount: number;
        selectKey: string;
      }
    >();
    accountRows.forEach((row) => {
      const key = row.rut !== "-" ? row.rut : row.displayName;
      if (!map.has(key)) {
        map.set(key, {
          displayName: row.displayName,
          rut: row.rut !== "-" ? row.rut : "-",
          accounts: new Set<string>(),
          outgoingCount: 0,
          outgoingAmount: 0,
          selectKey: row.selectKey,
        });
      }
      const entry = map.get(key)!;
      entry.outgoingCount += row.outgoingCount;
      entry.outgoingAmount += row.outgoingAmount;
      if (row.account && row.account !== "-") {
        entry.accounts.add(row.account);
      }
      if ((!entry.displayName || entry.displayName === "(sin información)") && row.displayName) {
        entry.displayName = row.displayName;
      }
      if (!entry.selectKey && row.selectKey) {
        entry.selectKey = row.selectKey;
      }
    });
    return Array.from(map.entries())
      .map(([key, entry]) => ({
        key,
        displayName: entry.displayName,
        rut: entry.rut,
        account: entry.accounts.size
          ? Array.from(entry.accounts).slice(0, 4).join(", ")
          : "-",
        outgoingCount: entry.outgoingCount,
        outgoingAmount: entry.outgoingAmount,
        selectKey: entry.selectKey,
      }))
      .sort((a, b) => {
        if (b.outgoingAmount !== a.outgoingAmount) return b.outgoingAmount - a.outgoingAmount;
        return b.outgoingCount - a.outgoingCount;
      });
  }, [accountRows]);

  const displayedLeaderboard = useMemo<LeaderboardDisplayRow[]>(
    () => (leaderboardGrouping === "account" ? accountRows : rutRows),
    [leaderboardGrouping, accountRows, rutRows]
  );

  const quickMonthOptions = useMemo(() => {
    const options = [{ value: "current", label: "Mes actual" }];
    for (let i = 1; i < MAX_MONTHS; i += 1) {
      const date = dayjs().subtract(i, "month");
      options.push({ value: date.format("YYYY-MM"), label: date.format("MMMM YYYY") });
    }
    options.push({ value: "custom", label: "Personalizado" });
    return options;
  }, []);

  async function loadParticipant(participant: string, range: RangeParams) {
    const trimmed = participant.trim();
    if (!trimmed) {
      return;
    }

    setDetailLoading(true);
    setDetailError(null);

    try {
      const data = await fetchParticipantInsight(trimmed, range);
      setMonthly(data.monthly);
      setCounterparts(data.counterparts);
      setVisible(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo obtener la información";
      setDetailError(message);
      setMonthly([]);
      setCounterparts([]);
      setVisible(false);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const rangeParams = resolveRange(quickMonth, from, to);
    setSelectedRange(rangeParams);

    const trimmedId = activeParticipantId;

    if (!trimmedId) {
      setDetailError(null);
      setMonthly([]);
      setCounterparts([]);
      setVisible(false);
      return;
    }

    await loadParticipant(trimmedId, rangeParams);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboard() {
      setLeaderboardLoading(true);
      setLeaderboardError(null);

      try {
        const data = await fetchParticipantLeaderboard({
          ...selectedRange,
          limit: leaderboardLimit,
          mode: "outgoing",
        });

        if (!cancelled) {
          setLeaderboard(data.participants);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error
              ? err.message
              : "No se pudo obtener el ranking de participantes";
          setLeaderboardError(message);
          setLeaderboard([]);
        }
      } finally {
        if (!cancelled) {
          setLeaderboardLoading(false);
        }
      }
    }

    loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [selectedRange, leaderboardLimit]);

  async function handleSelectParticipant(participant: string) {
    setParticipantId(participant);
    await loadParticipant(participant, selectedRange);
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Participantes en transacciones</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Revisa la actividad de un identificador en los campos <strong>Desde</strong> y <strong>Hacia</strong>,
          con un resumen mensual y las contrapartes más frecuentes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-[var(--brand-primary)]/15 bg-white p-6 text-sm text-slate-600 shadow-sm lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          ID participante
          <input
            type="text"
            value={participantId}
            onChange={(event) => setParticipantId(event.target.value)}
            className="rounded border px-3 py-2"
            placeholder="123861706983"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Rango rápido
          <select
            value={quickMonth}
            onChange={(event) => setQuickMonth(event.target.value)}
            className="rounded border px-3 py-2"
          >
            {quickMonthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Desde
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="rounded border px-3 py-2"
            disabled={quickMonth !== "custom"}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Hasta
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="rounded border px-3 py-2"
            disabled={quickMonth !== "custom"}
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={detailLoading}
            className="rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed"
          >
            {detailLoading ? "Buscando..." : "Consultar"}
          </button>
        </div>
      </form>

      <section className="space-y-4 rounded-2xl border border-[var(--brand-secondary)]/15 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[var(--brand-secondary)]">Ranking de retiros</h2>
            <p className="text-sm text-slate-600">
              Contrapartes con mayores egresos en el rango seleccionado, agrupadas por RUT y cuenta.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <label className="flex flex-col gap-1">
              Mostrar top
              <select
                value={leaderboardLimit}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setLeaderboardLimit(Number.isFinite(value) ? value : 10);
                }}
                className="rounded border px-3 py-2 text-sm normal-case"
              >
                {[10, 20, 30].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Agrupar por
              <select
                value={leaderboardGrouping}
                onChange={(event) =>
                  setLeaderboardGrouping(event.target.value as "account" | "rut")
                }
                className="rounded border px-3 py-2 text-sm normal-case"
              >
                <option value="account">Cuenta bancaria</option>
                <option value="rut">RUT</option>
              </select>
            </label>
          </div>
        </div>

        {leaderboardError && (
          <p className="rounded-lg bg-rose-100 px-4 py-3 text-sm text-rose-700">{leaderboardError}</p>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--brand-secondary)]/15 text-[var(--brand-secondary)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Titular</th>
                <th className="px-4 py-3 text-left font-semibold">RUT</th>
                <th className="px-4 py-3 text-left font-semibold">Cuenta</th>
                <th className="px-4 py-3 text-left font-semibold">Egresos (count)</th>
                <th className="px-4 py-3 text-left font-semibold">Egresos (monto)</th>
                <th className="px-4 py-3 text-left font-semibold">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Cargando ranking...
                  </td>
                </tr>
              ) : displayedLeaderboard.length ? (
                displayedLeaderboard.map((row) => {
                  const participantKey = row.selectKey;
                  const isActive = participantKey && participantKey === activeParticipantId;
                  return (
                    <tr
                      key={row.key}
                      className={`${isActive ? "bg-[var(--brand-secondary)]/10" : ""} odd:bg-slate-50/60`}
                    >
                      <td className="px-4 py-3 font-medium text-slate-700">{row.displayName}</td>
                      <td className="px-4 py-3 text-slate-600">{row.rut}</td>
                      <td className="px-4 py-3 text-slate-600">{row.account}</td>
                      <td className="px-4 py-3 text-slate-600">{row.outgoingCount}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtCLP(row.outgoingAmount)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <button
                          type="button"
                          onClick={() => {
                            if (!participantKey) return;
                            void handleSelectParticipant(participantKey);
                          }}
                          disabled={detailLoading || !participantKey}
                          className="rounded-full border border-[var(--brand-secondary)] px-3 py-1 text-xs font-semibold text-[var(--brand-secondary)] shadow-sm disabled:cursor-not-allowed"
                        >
                          {detailLoading && isActive
                            ? "Cargando..."
                            : "Ver detalle"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Sin participantes en el rango seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {detailError && <p className="rounded-lg bg-rose-100 px-4 py-3 text-sm text-rose-700">{detailError}</p>}

      {!visible ? (
        <p className="text-sm text-slate-500">
          {detailLoading
            ? "Buscando información del participante..."
            : "Ingresa un identificador y selecciona el rango para ver su actividad."}
        </p>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3 rounded-2xl border border-[var(--brand-primary)]/15 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--brand-primary)]">Resumen mensual</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Mes</th>
                    <th className="px-4 py-3 text-left font-semibold">Egresos (count)</th>
                    <th className="px-4 py-3 text-left font-semibold">Egresos (monto)</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((row) => (
                    <tr key={row.month} className="odd:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-slate-700">{dayjs(row.month).format("MMMM YYYY")}</td>
                      <td className="px-4 py-3 text-slate-600">{row.outgoingCount}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtCLP(row.outgoingAmount)}</td>
                    </tr>
                  ))}
                  {!monthly.length && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                        Sin movimientos en el rango seleccionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-[var(--brand-secondary)]/15 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--brand-secondary)]">Contrapartes</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--brand-secondary)]/15 text-[var(--brand-secondary)]">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Titular</th>
                    <th className="px-4 py-3 text-left font-semibold">RUT</th>
                    <th className="px-4 py-3 text-left font-semibold">Cuenta</th>
                    <th className="px-4 py-3 text-left font-semibold">Egresos (count)</th>
                    <th className="px-4 py-3 text-left font-semibold">Egresos (monto)</th>
                  </tr>
                </thead>
                <tbody>
                  {counterparts.map((row) => {
                    const key = row.withdrawId || row.counterpartId || row.counterpart;
                    const bankParts: string[] = [];
                    if (row.bankName) bankParts.push(row.bankName);
                    if (row.bankAccountNumber) {
                      const accountLabel = row.bankAccountType
                        ? `${row.bankAccountType} · ${row.bankAccountNumber}`
                        : row.bankAccountNumber;
                      bankParts.push(accountLabel);
                    }
                    if (row.bankBranch) bankParts.push(row.bankBranch);
                    const bankSummary = bankParts.join(" · ");

                    const metadataParts: string[] = [];
                    if (row.withdrawId) metadataParts.push(row.withdrawId);
                    if (row.identificationType && row.identificationNumber) {
                      metadataParts.push(`${row.identificationType} ${row.identificationNumber}`);
                    } else if (row.identificationNumber) {
                      metadataParts.push(row.identificationNumber);
                    }
                    if (row.counterpartId && row.counterpartId !== row.counterpart) {
                      metadataParts.push(row.counterpartId);
                    }
                    const metadata = metadataParts.join(" · ");

                    return (
                      <tr key={key} className="odd:bg-slate-50/60">
                        <td className="px-4 py-3 text-slate-700">
                          <div className="font-medium">
                            {row.bankAccountHolder || row.counterpart || "(desconocido)"}
                          </div>
                          {bankSummary && <div className="text-xs text-slate-500">{bankSummary}</div>}
                          {metadata && <div className="text-xs text-slate-400">{metadata}</div>}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.identificationNumber || "-"}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.bankAccountNumber || row.withdrawId || row.counterpartId || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.outgoingCount}</td>
                        <td className="px-4 py-3 text-slate-600">{fmtCLP(row.outgoingAmount)}</td>
                      </tr>
                    );
                  })}
                  {!counterparts.length && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                        No hay contrapartes registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
