import dayjs from "dayjs";
import { fmtCLP } from "../../../lib/format";
import type { BalanceDraft, BalancesApiResponse } from "../types";
import { formatBalanceInput } from "../utils";

type Props = {
  report: BalancesApiResponse | null;
  drafts: Record<string, BalanceDraft>;
  onDraftChange: (date: string, patch: Partial<BalanceDraft>) => void;
  onSave: (date: string) => void;
  saving: Record<string, boolean>;
  loading: boolean;
  error: string | null;
};

export function DailyBalancesPanel({
  report,
  drafts,
  onDraftChange,
  onSave,
  saving,
  loading,
  error,
}: Props) {
  return (
    <section className="space-y-3 rounded-2xl border border-[var(--brand-primary)]/10 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[var(--brand-primary)]">Saldos diarios</h2>
          <p className="text-xs text-slate-500">
            Registra el saldo de la cuenta a las 23:59 de cada día para conciliar los movimientos.
          </p>
        </div>
        {report?.previous && (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Saldo cierre previo ({dayjs(report.previous.date).format("DD-MM-YYYY")})
            <span className="ml-2 font-semibold text-slate-800">{fmtCLP(report.previous.balance)}</span>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-rose-100 px-4 py-2 text-xs text-rose-700">{error}</p>
      )}

      {loading ? (
        <p className="px-4 py-3 text-sm text-[var(--brand-primary)]">Cargando saldos diarios...</p>
      ) : !report ? (
        <p className="px-4 py-3 text-sm text-slate-500">
          Selecciona un rango con movimientos para conciliar los saldos diarios.
        </p>
      ) : report.days.length === 0 ? (
        <p className="px-4 py-3 text-sm text-slate-500">
          No hay días registrados en el rango actual.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                <th className="px-4 py-3 text-left font-semibold">Ingresos</th>
                <th className="px-4 py-3 text-left font-semibold">Egresos</th>
                <th className="px-4 py-3 text-left font-semibold">Variación neta</th>
                <th className="px-4 py-3 text-left font-semibold">Saldo esperado</th>
                <th className="px-4 py-3 text-left font-semibold">Saldo registrado</th>
                <th className="px-4 py-3 text-left font-semibold">Diferencia</th>
                <th className="px-4 py-3 text-left font-semibold">Nota</th>
                <th className="px-4 py-3 text-left font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {report.days.map((day) => {
                const draft = drafts[day.date] ?? { value: "", note: "" };
                const defaultValue = day.recordedBalance != null ? formatBalanceInput(day.recordedBalance) : "";
                const defaultNote = day.note ?? "";
                const isSaving = Boolean(saving[day.date]);
                const isDirty = draft.value !== defaultValue || draft.note !== defaultNote;
                const hasValue = draft.value.trim().length > 0 || defaultValue.trim().length > 0;
                const canSave = isDirty && hasValue && !isSaving;
                const mismatch = day.difference != null && Math.abs(day.difference) > 1;

                return (
                  <tr key={day.date} className="align-top odd:bg-slate-50/60">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                      <div className="flex flex-col gap-1">
                        <span>{dayjs(day.date).format("DD-MM-YYYY")}</span>
                        {day.hasCashback && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            Cashback excluido
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-emerald-600">{fmtCLP(Math.abs(day.totalIn))}</td>
                    <td className="px-4 py-3 text-rose-600">-{fmtCLP(Math.abs(day.totalOut))}</td>
                    <td className={`px-4 py-3 font-semibold ${day.netChange >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {day.netChange >= 0 ? fmtCLP(day.netChange) : `-${fmtCLP(Math.abs(day.netChange))}`}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {day.expectedBalance != null ? fmtCLP(day.expectedBalance) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={draft.value}
                        onChange={(event) => onDraftChange(day.date, { value: event.target.value })}
                        className="w-full rounded border px-2 py-1 text-sm"
                        placeholder="0"
                      />
                    </td>
                    <td
                      className={`px-4 py-3 font-semibold ${
                        mismatch ? "text-rose-600" : "text-slate-600"
                      }`}
                    >
                      {day.difference != null
                        ? day.difference >= 0
                          ? fmtCLP(day.difference)
                          : `-${fmtCLP(Math.abs(day.difference))}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <textarea
                        rows={2}
                        value={draft.note}
                        onChange={(event) => onDraftChange(day.date, { note: event.target.value })}
                        className="w-full rounded border px-2 py-1 text-xs"
                        placeholder="Comentario opcional"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onSave(day.date)}
                        disabled={!canSave}
                        className="rounded-full bg-[var(--brand-primary)] px-3 py-1 text-xs font-semibold text-white shadow disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSaving ? "Guardando..." : "Guardar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
