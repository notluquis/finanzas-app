import dayjs from "dayjs";
import { fmtCLP } from "../../../lib/format";
import type { BalancesApiResponse } from "../types";

export type BalanceSummaryProps = {
  report: BalancesApiResponse | undefined | null;
  loading: boolean;
  error: string | null;
};

type MismatchDay = NonNullable<BalancesApiResponse>["days"][number];

function useBalanceReportSummary(report: BalancesApiResponse | undefined | null) {
  if (!report) {
    return {
      mismatchDays: [],
      hasRecordedBalances: false,
      lastRecorded: null,
      lastExpected: null,
    };
  }

  const mismatchDays = report.days.filter((day) => day.difference != null && Math.abs(day.difference) > 1);
  const hasRecordedBalances = report.days.some((day) => day.recordedBalance != null);
  const lastRecorded = [...report.days].reverse().find((day) => day.recordedBalance != null) ?? null;
  const lastExpected = [...report.days].reverse().find((day) => day.expectedBalance != null) ?? null;

  return { mismatchDays, hasRecordedBalances, lastRecorded, lastExpected };
}

function formatSignedCLP(value: number) {
  return value >= 0 ? fmtCLP(value) : `-${fmtCLP(Math.abs(value))}`;
}

export function BalanceSummary({ report, loading, error }: BalanceSummaryProps) {
  const { mismatchDays, hasRecordedBalances, lastRecorded, lastExpected } = useBalanceReportSummary(report);

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--brand-primary)]/10 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-[var(--brand-primary)]">Conciliación de saldo</h2>
      {error && <p className="rounded bg-rose-100 px-3 py-2 text-xs text-rose-700">{error}</p>}
      {loading ? (
        <p className="text-sm text-[var(--brand-primary)]">Cargando conciliación...</p>
      ) : !report ? (
        <p className="text-sm text-slate-500">
          Selecciona un rango para revisar los saldos de cierre registrados.
        </p>
      ) : !hasRecordedBalances ? (
        <p className="text-sm text-slate-500">
          Aún no registras saldos de cierre para este rango. Actualiza la sección de Saldos diarios
          en la página de movimientos para comenzar la conciliación.
        </p>
      ) : (
        <div className="space-y-3 text-xs text-slate-600">
          {report.previous && (
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500">
              Saldo cierre previo ({dayjs(report.previous.date).format("DD-MM-YYYY")} 23:59):
              <span className="ml-2 font-semibold text-slate-800">
                {fmtCLP(report.previous.balance)}
              </span>
            </div>
          )}

          {lastRecorded && (
            <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
              Último saldo registrado ({dayjs(lastRecorded.date).format("DD-MM-YYYY")} 23:59)
              <span className="ml-2 font-semibold text-emerald-800">
                {fmtCLP(lastRecorded.recordedBalance!)}
              </span>
              {lastRecorded.difference != null && Math.abs(lastRecorded.difference) > 1 && (
                <span className="ml-2 font-semibold text-rose-600">
                  Dif: {formatSignedCLP(lastRecorded.difference)}
                </span>
              )}
            </div>
          )}

          {!lastRecorded && lastExpected && (
            <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
              Saldo esperado del último día ({dayjs(lastExpected.date).format("DD-MM-YYYY")}):
              <span className="ml-2 font-semibold text-slate-800">
                {fmtCLP(lastExpected.expectedBalance!)}
              </span>
            </div>
          )}

          {mismatchDays.length > 0 ? (
            <MismatchSummary mismatchDays={mismatchDays} />
          ) : (
            <p className="font-semibold text-emerald-600">
              Los saldos registrados coinciden con los movimientos del rango seleccionado.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function MismatchSummary({ mismatchDays }: { mismatchDays: MismatchDay[] }) {
  return (
    <div className="space-y-1">
      <p className="font-semibold text-rose-600">
        Hay {mismatchDays.length} día{mismatchDays.length > 1 ? "s" : ""} con diferencias entre el saldo esperado y el
        registrado.
      </p>
      <ul className="space-y-1 text-slate-600">
        {mismatchDays.slice(0, 5).map((day) => (
          <li key={day.date} className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-700">{dayjs(day.date).format("DD-MM-YYYY")}</span>
            <span>Diferencia:</span>
            <span className="font-semibold text-rose-600">{formatSignedCLP(day.difference ?? 0)}</span>
            {day.expectedBalance != null && (
              <span className="text-slate-500">Esperado {fmtCLP(day.expectedBalance)}</span>
            )}
            {day.recordedBalance != null && (
              <span className="text-slate-500">Registrado {fmtCLP(day.recordedBalance)}</span>
            )}
          </li>
        ))}
        {mismatchDays.length > 5 && <li className="text-slate-500">... y {mismatchDays.length - 5} más</li>}
      </ul>
    </div>
  );
}
