import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { createCounterpart, fetchCounterpart, fetchCounterpartSummary, fetchCounterparts, updateCounterpart } from "../features/counterparts/api";
import type { Counterpart, CounterpartAccount, CounterpartSummary } from "../features/counterparts/types";
import CounterpartList from "../features/counterparts/components/CounterpartList";
import CounterpartForm from "../features/counterparts/components/CounterpartForm";
import AssociatedAccounts from "../features/counterparts/components/AssociatedAccounts";
import MonthlySummaryChart from "../features/counterparts/components/MonthlySummaryChart";
import ConceptList from "../features/counterparts/components/ConceptList";
import Input from "../components/Input";
import Button from "../components/Button";
import { SUMMARY_RANGE_MONTHS } from "../features/counterparts/constants";

// Removed unused helper normalizeExternalUrl and various unused constants/imports during cleanup.

export default function CounterpartsPage() {
  const [counterparts, setCounterparts] = useState<Counterpart[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ counterpart: Counterpart; accounts: CounterpartAccount[] } | null>(null);
  const [formStatus, setFormStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  const [summaryRange, setSummaryRange] = useState<{ from: string; to: string }>(() => ({
    from: dayjs().subtract(SUMMARY_RANGE_MONTHS, "month").startOf("month").format("YYYY-MM-DD"),
    to: dayjs().endOf("month").format("YYYY-MM-DD"),
  }));
  const [summary, setSummary] = useState<CounterpartSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const list = await fetchCounterparts();
      setCounterparts(list);
      if (list.length) {
        selectCounterpart(list[0].id);
      }
    }
    load().catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadSummary(selectedId, summaryRange.from, summaryRange.to).catch((err) =>
        setError(err instanceof Error ? err.message : String(err))
      );
    }
  }, [selectedId, summaryRange.from, summaryRange.to]);

  async function selectCounterpart(id: number | null) {
    setError(null);
    setSummary(null);
    setDetail(null);
    setSelectedId(id);
    if (!id) {
      return;
    }
    try {
      const data = await fetchCounterpart(id);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSaveCounterpart(payload: any) {
    setFormStatus("saving");
    setError(null);
    try {
      if (!payload.name) {
        throw new Error("El nombre es obligatorio");
      }
      let id = selectedId;
      if (id) {
        const data = await updateCounterpart(id, payload);
        setDetail(data);
        id = data.counterpart.id;
        setCounterparts((prev) =>
          prev.map((item) => (item.id === id ? data.counterpart : item)).sort((a, b) => a.name.localeCompare(b.name))
        );
      } else {
        const data = await createCounterpart(payload);
        setDetail(data);
        id = data.counterpart.id;
        setCounterparts((prev) => [...prev, data.counterpart].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setSelectedId(id);
      if (id) {
        await loadSummary(id, summaryRange.from, summaryRange.to);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFormStatus("idle");
    }
  }

  async function loadSummary(counterpartId: number, from: string, to: string) {
    setSummaryLoading(true);
    try {
      const data = await fetchCounterpartSummary(counterpartId, { from, to });
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSummaryLoading(false);
    }
  }

  const summaryConcepts = useMemo(() => {
    const map = new Map<string, number>();
    summary?.byAccount.forEach((row) => {
      const key = row.concept ?? "Sin concepto";
      map.set(key, (map.get(key) ?? 0) + row.total);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [summary]);

  return (
    <section className="flex flex-col gap-6 xl:flex-row xl:items-start">
      <div className="xl:w-72 xl:flex-shrink-0">
        <CounterpartList counterparts={counterparts} selectedId={selectedId} onSelectCounterpart={selectCounterpart} />
      </div>

      <div className="flex-1 space-y-6">
        <CounterpartForm
          counterpart={detail?.counterpart}
          onSave={handleSaveCounterpart}
          error={error}
          saving={formStatus === "saving"}
        />

        {selectedId && detail && (
          <AssociatedAccounts
            selectedId={selectedId}
            detail={detail}
            summary={summary}
            summaryRange={summaryRange}
            onSaveCounterpart={handleSaveCounterpart}
            onLoadSummary={loadSummary}
          />
        )}
        {selectedId && (
          <section className="glass-card glass-underlay-gradient space-y-5 p-6">
            <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-[var(--brand-primary)] drop-shadow-sm">Resumen mensual</h2>
                <p className="text-xs text-slate-600/90">Transferencias de egreso asociadas a esta contraparte.</p>
              </div>
              <div className="flex flex-wrap items-end gap-3 text-xs">
                <Input
                  label="Desde"
                  type="date"
                  value={summaryRange.from}
                  onChange={(event) => setSummaryRange((prev) => ({ ...prev, from: event.target.value }))}
                  className="w-40"
                />
                <Input
                  label="Hasta"
                  type="date"
                  value={summaryRange.to}
                  onChange={(event) => setSummaryRange((prev) => ({ ...prev, to: event.target.value }))}
                  className="w-40"
                />
                <Button
                  size="sm"
                  onClick={() => selectedId && loadSummary(selectedId, summaryRange.from, summaryRange.to)}
                  disabled={summaryLoading}
                >
                  {summaryLoading ? "Calculando..." : "Actualizar"}
                </Button>
              </div>
            </header>
            {summaryLoading ? (
              <p className="text-xs text-slate-600">Calculando resumen...</p>
            ) : summary ? (
              <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
                <MonthlySummaryChart data={summary.monthly} />
                <ConceptList concepts={summaryConcepts} />
              </div>
            ) : (
              <p className="text-xs text-slate-600">No hay datos disponibles.</p>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
