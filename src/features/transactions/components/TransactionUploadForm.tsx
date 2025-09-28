import { useState } from "react";
import { uploadFiles } from "../../../lib/apiClient";
import { logger } from "../../../lib/logger";
import { analyzeTransactionHeaders } from "../../../lib/csvUtils";
import Button from "../../../components/Button";
import FileInput from "../../../components/FileInput";
import Alert from "../../../components/Alert";
import UploadResults from "../../../components/UploadResults";

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

export default function TransactionUploadForm() {
  const {
    files,
    setFiles,
    loading,
    error,
    results,
    handleUpload: handleTransactionsUpload,
    reset: resetTransactions,
  } = useFileUpload("/api/transactions/upload", "[upload]");

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    resetTransactions();

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

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--brand-primary)]/15 bg-white p-6 text-sm shadow-sm">
      <FileInput
        label="Selecciona uno o varios archivos CSV de Mercado Pago"
        accept=".csv,.txt"
        onChange={handleFileChange}
        multiple
      />
      <Button
        onClick={handleTransactionsUpload}
        disabled={loading}
      >
        {loading ? "Subiendo..." : "Subir a la base de datos"}
      </Button>
      <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
        <li>El archivo no debe superar los 15&nbsp;MB.</li>
        <li>Los movimientos duplicados se ignoran automáticamente.</li>
      </ul>
      {files.length > 0 && !loading && !error && (
        <p className="text-xs text-slate-500">
          Archivos seleccionados: {files.map((f) => f.name).join(", ")}
        </p>
      )}
      {error && <Alert variant="error">{error}</Alert>}
      <UploadResults results={results} />
    </div>
  );
}
