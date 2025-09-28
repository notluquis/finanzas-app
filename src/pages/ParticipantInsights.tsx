import { useEffect, useMemo } from "react";
import dayjs from "dayjs";
import { fmtCLP } from "../lib/format";
import { formatRut } from "../lib/rut";
import { useParticipantInsightsData } from "../features/participants/hooks/useParticipantInsightsData";
import Alert from "../components/Alert";
import Input from "../components/Input";
import Button from "../components/Button";

export default function ParticipantInsightsPage() {
  const {
    participantId,
    setParticipantId,
    from,
    setFrom,
    to,
    setTo,
    quickMonth,
    setQuickMonth,
    monthly,
    counterparts,
    visible,
    detailLoading,
    detailError,
    leaderboardLimit,
    setLeaderboardLimit,
    leaderboardGrouping,
    setLeaderboardGrouping,
    leaderboardLoading,
    leaderboardError,
    displayedLeaderboard,
    quickMonthOptions,
    handleSubmit,
    handleSelectParticipant,
  } = useParticipantInsightsData();

  return (
    <section className="space-y-6">
      <div className="glass-card glass-underlay-gradient space-y-2 p-6">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)] drop-shadow-sm">Participantes en transacciones</h1>
        <p className="max-w-2xl text-sm text-slate-600/90">
          Revisa la actividad de un identificador en los campos <strong>Desde</strong> y <strong>Hacia</strong>,
          con un resumen mensual y las contrapartes más frecuentes.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="glass-card glass-underlay-gradient grid gap-4 p-6 text-sm text-slate-600 lg:grid-cols-4"
      >
        <Input
          label="ID participante"
          type="text"
          value={participantId}
          onChange={(event) => setParticipantId(event.target.value)}
          placeholder="123861706983"
        />
        <Input
          label="Rango rápido"
          type="select"
          value={quickMonth}
          onChange={(event) => setQuickMonth(event.target.value)}
        >
          {quickMonthOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Input>
        <Input
          label="Desde"
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          disabled={quickMonth !== "custom"}
        />
        <Input
          label="Hasta"
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          disabled={quickMonth !== "custom"}
        />
        <div className="flex items-end">
          <Button type="submit" disabled={detailLoading} size="sm">
            {detailLoading ? "Buscando..." : "Consultar"}
          </Button>
        </div>
      </form>

      <section className="space-y-4 glass-card glass-underlay-gradient p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[var(--brand-secondary)]">Ranking de retiros</h2>
            <p className="text-sm text-slate-600">
              Contrapartes con mayores egresos en el rango seleccionado, agrupadas por RUT y cuenta.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Input
              label="Mostrar top"
              type="select"
              value={leaderboardLimit}
              onChange={(event) => {
                const value = Number(event.target.value);
                setLeaderboardLimit(Number.isFinite(value) ? value : 10);
              }}
              className="normal-case"
            >
              {[10, 20, 30].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Input>
            <Input
              label="Agrupar por"
              type="select"
              value={leaderboardGrouping}
              onChange={(event) =>
                setLeaderboardGrouping(event.target.value as "account" | "rut")
              }
              className="normal-case"
            >
              <option value="account">Cuenta bancaria</option>
              <option value="rut">RUT</option>
            </Input>
          </div>
        </div>

        {leaderboardError && (
          <Alert variant="error">{leaderboardError}</Alert>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-600">
            <thead className="bg-white/60 text-[var(--brand-secondary)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Titular</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">RUT</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Cuenta</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Egresos (count)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Egresos (monto)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Detalle</th>
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
                  const isActive = participantKey && participantKey === participantId.trim();
                  return (
                    <tr
                      key={row.key}
                      className={`border-b border-white/45 bg-white/45 transition-colors last:border-none even:bg-white/35 ${
                        isActive ? "bg-[var(--brand-secondary)]/15" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-slate-700">{row.displayName}</td>
                      <td className="px-4 py-3 text-slate-600">{row.rut}</td>
                      <td className="px-4 py-3 text-slate-600">{row.account}</td>
                      <td className="px-4 py-3 text-slate-600">{row.outgoingCount}</td>
                      <td className="px-4 py-3 text-slate-600">{fmtCLP(row.outgoingAmount)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            if (!participantKey) return;
                            void handleSelectParticipant(participantKey);
                          }}
                          disabled={detailLoading || !participantKey}
                        >
                          {detailLoading && isActive
                            ? "Cargando..."
                            : "Ver detalle"}
                        </Button>
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

      {detailError && <Alert variant="error">{detailError}</Alert>}

      {!visible ? (
        <p className="text-sm text-slate-500">
          {detailLoading
            ? "Buscando información del participante..."
            : "Ingresa un identificador y selecciona el rango para ver su actividad."}
        </p>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3 glass-card glass-underlay-gradient p-6">
            <h2 className="text-lg font-semibold text-[var(--brand-primary)]">Resumen mensual</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-slate-600">
                <thead className="bg-white/60 text-[var(--brand-primary)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Mes</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Egresos (count)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Egresos (monto)</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((row) => (
                    <tr key={row.month} className="border-b border-white/45 bg-white/45 last:border-none even:bg-white/35">
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

          <section className="space-y-3 glass-card glass-underlay-gradient p-6">
            <h2 className="text-lg font-semibold text-[var(--brand-secondary)]">Contrapartes</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-slate-600">
                <thead className="bg-white/60 text-[var(--brand-secondary)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Titular</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">RUT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Cuenta</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Egresos (count)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Egresos (monto)</th>
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
                      <tr key={key} className="border-b border-white/45 bg-white/45 last:border-none even:bg-white/35">
                        <td className="px-4 py-3 text-slate-700">
                          <div className="font-medium">
                            {row.bankAccountHolder || row.counterpart || "(desconocido)"}
                          </div>
                          {bankSummary && <div className="text-xs text-slate-500/90">{bankSummary}</div>}
                          {metadata && <div className="text-xs text-slate-400/80">{metadata}</div>}
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
