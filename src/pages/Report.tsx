import { useMemo, useState } from "react";
import { deriveMovements, parseDelimited, type Movement } from "../mp/reports";
import { coerceAmount, fmtCLP } from "../lib/format";
import { useSettings } from "../context/SettingsContext";

type LedgerMovement = Movement & { runningBalance: number; delta: number };

export default function Report() {
  const [movs, setMovs] = useState<Movement[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialBalance, setInitialBalance] = useState<string>("0");

  const initialBalanceNumber = useMemo(
    () => coerceAmount(initialBalance),
    [initialBalance]
  );

  const { settings } = useSettings();

  const ledger = useMemo<LedgerMovement[]>(() => {
    let balance = initialBalanceNumber;
    return movs.map((m) => {
      const delta = m.direction === "IN" ? m.amount : m.direction === "OUT" ? -m.amount : 0;
      balance += delta;
      return { ...m, runningBalance: balance, delta };
    });
  }, [movs, initialBalanceNumber]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const rows = parseDelimited(text);
      setMovs(deriveMovements(rows, { accountName: settings.orgName }));
      setFileName(f.name);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al leer el archivo";
      setError(message);
      setMovs([]);
      setFileName(null);
    }
  }

  const formatBalance = (value?: number) =>
    typeof value === "number" && Number.isFinite(value) ? fmtCLP(value) : "-";

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Reporte financiero</h1>
        <p className="text-sm text-slate-600">
          Visualiza y valida un CSV antes de cargarlo en la base. Ajusta el saldo inicial para
          obtener la evolución al instante.
        </p>
      </div>
      <div className="space-y-3 rounded-2xl border border-[var(--brand-primary)]/15 bg-white p-6 text-sm shadow-sm">
        <p>
          Genera el <strong>Account balance report</strong> desde el panel de Mercado Pago y
          súbelo para ver los movimientos IN/OUT.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-xs text-gray-600">
          <li>Dashboard &rarr; Reports &rarr; Finanzas &rarr; Account balance report.</li>
          <li>Descarga el archivo en CSV (o formato delimitado compatible) y cárgalo aquí.</li>
        </ul>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex w-full flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide">
              Saldo inicial (CLP)
            </span>
            <input
              type="text"
              value={initialBalance}
              onChange={(event) => setInitialBalance(event.target.value)}
              className="rounded border px-3 py-2 text-sm"
              placeholder="0"
            />
          </label>
          <label className="flex w-full flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide">Archivo CSV</span>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={onFile}
              className="rounded border px-3 py-2 text-sm"
            />
          </label>
        </div>
        {fileName && !error && (
          <p className="text-xs text-gray-500">Archivo cargado: {fileName}</p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <div className="overflow-hidden rounded-2xl border border-[var(--brand-primary)]/15 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Fecha</th>
              <th className="px-4 py-3 text-left font-semibold">Descripción</th>
              <th className="px-4 py-3 text-left font-semibold">Desde</th>
              <th className="px-4 py-3 text-left font-semibold">Hacia</th>
              <th className="px-4 py-3 text-left font-semibold">Tipo</th>
              <th className="px-4 py-3 text-left font-semibold">Monto</th>
              <th className="px-4 py-3 text-left font-semibold">Saldo cuenta</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((m, i) => (
              <tr key={i} className="odd:bg-slate-50/60">
                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                  {m.timestamp}
                </td>
                <td className="px-4 py-3">{m.description ?? m.counterparty ?? "-"}</td>
                <td className="px-4 py-3">{m.from ?? "-"}</td>
                <td className="px-4 py-3">{m.to ?? "-"}</td>
                <td className="px-4 py-3">{renderDirection(m.direction)}</td>
                <td
                  className={`px-4 py-3 font-semibold ${
                    m.direction === "IN"
                      ? "text-emerald-600"
                      : m.direction === "OUT"
                        ? "text-rose-600"
                        : "text-slate-600"
                  }`}
                >
                  {formatAmount(m.direction, m.amount)}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-700">
                  {formatBalance(m.runningBalance)}
                </td>
              </tr>
            ))}
            {!ledger.length && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                  Carga un reporte de saldo para ver los movimientos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function renderDirection(direction: Movement["direction"]) {
  if (direction === "IN") return "Ingreso";
  if (direction === "OUT") return "Egreso";
  return "Neutro";
}

function formatAmount(direction: Movement["direction"], amount: number) {
  const formatted = fmtCLP(amount);
  return direction === "OUT" ? `-${formatted}` : formatted;
}
