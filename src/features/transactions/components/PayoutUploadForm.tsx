import { useState } from "react";
import { uploadFiles } from "../../../lib/apiClient";
import { fileHasWithdrawHeader } from "../../../lib/csvUtils";
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

export default function PayoutUploadForm() {
  const {
    files: payoutFiles,
    setFiles: setPayoutFiles,
    loading: payoutLoading,
    error: payoutError,
    results: payoutResults,
    handleUpload: handlePayoutUpload,
    reset: resetPayouts,
  } = useFileUpload("/api/transactions/withdrawals/upload", "[withdrawals]");

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
    <div className="mt-8 space-y-3 border-t border-slate-200 pt-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Subir CSV de retiros
      </h2>
      <p className="text-xs text-slate-500">
        Complementa los retiros con los datos bancarios y del titular para que se reflejen junto a los movimientos existentes.
      </p>
      <FileInput
        label="Selecciona los archivos CSV de retiros"
        accept=".csv,.txt"
        onChange={handlePayoutFileChange}
        multiple
      />
      <Button
        variant="secondary"
        onClick={handlePayoutUpload}
        disabled={payoutLoading}
      >
        {payoutLoading ? "Subiendo retiros..." : "Importar retiros"}
      </Button>
      {payoutFiles.length > 0 && !payoutLoading && !payoutError && (
        <p className="text-xs text-slate-500">
          Archivos seleccionados: {payoutFiles.map((f) => f.name).join(", ")}
        </p>
      )}
      {payoutError && <Alert variant="error">{payoutError}</Alert>}
      <UploadResults results={payoutResults} variant="secondary" />
    </div>
  );
}
