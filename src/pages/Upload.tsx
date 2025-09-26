import { useState } from "react";
import { uploadFiles } from "../lib/apiClient";
import { useAuth } from "../context/AuthContext";
import { logger } from "../lib/logger";
import { analyzeTransactionHeaders, fileHasWithdrawHeader } from "../lib/csvUtils";

type UploadSummary = {
  status: string;
  inserted: number;
  skipped?: number;
  updated?: number;
  total: number;
};

type UploadResult = {
  file: string;
  summary?: UploadSummary;
  error?: string;
};

function useFileUpload(endpoint: string, logContext: string) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UploadResult[]>([]);

  const handleUpload = async () => {
    if (!files.length) {
      setError("Selecciona uno o más archivos CSV antes de subirlos.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults([]);

    const uploadResults = await uploadFiles(files, endpoint, logContext);
    setResults(uploadResults);
    setLoading(false);
  };

  const reset = () => {
    setFiles([]);
    setError(null);
    setResults([]);
  };

  return { files, setFiles, loading, error, results, handleUpload, reset };
}

export default function Upload() {
  const {
    files,
    setFiles,
    loading,
    error,
    results,
    handleUpload: handleTransactionsUpload,
    reset: resetTransactions,
  } = useFileUpload("/api/transactions/upload", "[upload]");

  const {
    files: payoutFiles,
    setFiles: setPayoutFiles,
    loading: payoutLoading,
    error: payoutError,
    results: payoutResults,
    handleUpload: handlePayoutUpload,
    reset: resetPayouts,
  } = useFileUpload("/api/transactions/withdrawals/upload", "[withdrawals]");

  const { hasRole } = useAuth();

  const canUpload = hasRole("GOD", "ADMIN", "ANALYST");

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    resetTransactions();
    resetPayouts();

    if (!selected.length) {
      setFiles([]);
      return;
    }

    const analyses = await Promise.all(
      selected.map(async (file) => ({ file, ...(await analyzeTransactionHeaders(file)) }))
    );

    const problematic = analyses.filter((item) => item.missing.length);
    logger.info("[upload] archivos seleccionados", analyses.map(({ file, headersCount, missing }) => ({
      file: file.name,
      headersCount,
      missing,
    })));
    if (problematic.length) {
      const message = problematic
        .map(
          ({ file, missing, headersCount }) =>
            `${file.name}: faltan ${missing.join(", ")} · columnas detectadas: ${headersCount}`
        )
        .join("\n");

      const proceed = window.confirm(
        `Advertencia: algunos archivos no contienen todas las columnas esperadas.\n\n${message}\n\n¿Deseas continuar igualmente?`
      );

      if (!proceed) {
        setFiles([]);
        event.target.value = "";
        return;
      }
    }

    setFiles(selected);
  };

  const handlePayoutFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    resetPayouts();

    if (!selected.length) {
      setPayoutFiles([]);
      return;
    }

    const analyses = await Promise.all(selected.map(async (file) => ({ file, hasToken: await fileHasWithdrawHeader(file) })));
    const problematic = analyses.filter((item) => !item.hasToken);
    if (problematic.length) {
      const message = problematic.map(({ file }) => `${file.name}: no se encontró la columna withdraw_id`).join("\n");
      const proceed = window.confirm(
        `Advertencia: algunos archivos no parecen contener retiros válidos.\n\n${message}\n\n¿Deseas continuar igualmente?`
      );
      if (!proceed) {
        setPayoutFiles([]);
        event.target.value = "";
        return;
      }
    }

    setPayoutFiles(selected);
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Subir CSV a la base de datos</h1>
        <p className="text-sm text-slate-600">
          Envía el reporte de Mercado Pago directamente a tu base de datos MySQL en HostGator. Detectamos
          las filas duplicadas usando la fecha, la dirección, el monto y el archivo de origen.
        </p>
      </div>

      {!canUpload ? (
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-sm text-rose-600 shadow-sm">
          No tienes permisos para subir movimientos. Solicita acceso a un administrador.
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-[var(--brand-primary)]/15 bg-white p-6 text-sm shadow-sm">
          <label className="flex w-full flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Selecciona uno o varios archivos CSV de Mercado Pago
            </span>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              multiple
              className="rounded border px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={handleTransactionsUpload}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed"
            style={{ background: "var(--brand-primary)", opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Subiendo..." : "Subir a la base de datos"}
          </button>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
            <li>El archivo no debe superar los 15&nbsp;MB.</li>
            <li>Los movimientos duplicados se ignoran automáticamente.</li>
          </ul>
          {files.length > 0 && !loading && !error && (
            <p className="text-xs text-slate-500">
              Archivos seleccionados: {files.map((f) => f.name).join(", ")}
            </p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          {results.length > 0 && (
            <div className="space-y-2 rounded-lg bg-[var(--brand-primary)]/10 p-4 text-xs text-[var(--brand-primary)]">
              <p className="font-semibold">Resultados</p>
              <ul className="space-y-1 text-slate-600">
                {results.map((result) => (
                  <li key={result.file} className="flex flex-wrap items-center justify-between gap-2">
                    <span>{result.file}</span>
                    {result.summary ? (
                      <span>
                        Insertadas: {result.summary.inserted}
                        {typeof result.summary.updated === "number"
                          ? ` · Actualizadas: ${result.summary.updated}`
                          : typeof result.summary.skipped === "number"
                            ? ` · Omitidas: ${result.summary.skipped}`
                            : ""}
                        · Total: {result.summary.total}
                      </span>
                    ) : (
                      <span className="text-rose-600">{result.error}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 space-y-3 border-t border-slate-200 pt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Subir CSV de retiros
            </h2>
            <p className="text-xs text-slate-500">
              Complementa los retiros con los datos bancarios y del titular para que se reflejen junto a los movimientos existentes.
            </p>
            <label className="flex w-full flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Selecciona los archivos CSV de retiros
              </span>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handlePayoutFileChange}
                multiple
                className="rounded border px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={handlePayoutUpload}
              disabled={payoutLoading}
              className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed"
              style={{ background: "var(--brand-secondary)", opacity: payoutLoading ? 0.6 : 1 }}
            >
              {payoutLoading ? "Subiendo retiros..." : "Importar retiros"}
            </button>
            {payoutFiles.length > 0 && !payoutLoading && !payoutError && (
              <p className="text-xs text-slate-500">
                Archivos seleccionados: {payoutFiles.map((f) => f.name).join(", ")}
              </p>
            )}
            {payoutError && <p className="text-xs text-red-600">{payoutError}</p>}
            {payoutResults.length > 0 && (
              <div className="space-y-2 rounded-lg bg-[var(--brand-secondary)]/10 p-4 text-xs text-[var(--brand-secondary)]">
                <p className="font-semibold">Retiros procesados</p>
                <ul className="space-y-1 text-slate-600">
                  {payoutResults.map((result) => (
                    <li key={result.file} className="flex flex-wrap items-center justify-between gap-2">
                      <span>{result.file}</span>
                      {result.summary ? (
                        <span>
                          Insertadas: {result.summary.inserted}
                          {typeof result.summary.updated === "number" ? ` · Actualizadas: ${result.summary.updated}` : ""}
                          · Total: {result.summary.total}
                        </span>
                      ) : (
                        <span className="text-rose-600">{result.error}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}