import { useMemo, useState } from "react";
import dayjs from "dayjs";
import Button from "../../../components/Button";
import Modal from "../../../components/Modal";
import Input from "../../../components/Input";
import type { LoanSchedule, LoanSummary, RegenerateSchedulePayload } from "../types";
import LoanScheduleTable from "./LoanScheduleTable";

interface LoanDetailProps {
  loan: LoanSummary | null;
  schedules: LoanSchedule[];
  summary: {
    total_expected: number;
    total_paid: number;
    remaining_amount: number;
    paid_installments: number;
    pending_installments: number;
  } | null;
  loading: boolean;
  canManage: boolean;
  onRegenerate: (payload: RegenerateSchedulePayload) => Promise<void>;
  onRegisterPayment: (schedule: LoanSchedule) => void;
  onUnlinkPayment: (schedule: LoanSchedule) => void;
}

export function LoanDetail({
  loan,
  schedules,
  summary,
  loading,
  canManage,
  onRegenerate,
  onRegisterPayment,
  onUnlinkPayment,
}: LoanDetailProps) {
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerateForm, setRegenerateForm] = useState<RegenerateSchedulePayload>({});
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  const statusBadge = useMemo(() => {
    if (!loan) return { label: "", className: "" };
    switch (loan.status) {
      case "COMPLETED":
        return { label: "Liquidado", className: "bg-emerald-100 text-emerald-700" };
      case "DEFAULTED":
        return { label: "En mora", className: "bg-rose-100 text-rose-700" };
      default:
        return { label: "Activo", className: "bg-amber-100 text-amber-700" };
    }
  }, [loan]);

  const handleRegenerate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loan) return;
    setRegenerating(true);
    setRegenerateError(null);
    try {
      await onRegenerate(regenerateForm);
      setRegenerateOpen(false);
      setRegenerateForm({});
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo regenerar el cronograma";
      setRegenerateError(message);
    } finally {
      setRegenerating(false);
    }
  };

  if (!loan) {
    return (
      <section className="glass-card glass-underlay-gradient flex h-full flex-col items-center justify-center rounded-3xl p-10 text-sm text-slate-500">
        <p>Selecciona un préstamo para ver el detalle.</p>
      </section>
    );
  }

  return (
    <section className="glass-card glass-underlay-gradient relative flex h-full flex-col gap-6 rounded-3xl p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-[var(--brand-primary)] drop-shadow-sm">{loan.title}</h1>
          <p className="text-sm text-slate-600/90">
            {loan.borrower_name} · {loan.borrower_type === "PERSON" ? "Persona natural" : "Empresa"}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>Inicio {dayjs(loan.start_date).format("DD MMM YYYY")}</span>
            <span>{loan.total_installments} cuotas · {loan.frequency === "WEEKLY" ? "semanal" : loan.frequency === "BIWEEKLY" ? "quincenal" : "mensual"}</span>
            <span>Tasa {loan.interest_rate.toLocaleString("es-CL")}%</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusBadge.className}`}>
            {statusBadge.label}
          </span>
          {canManage && (
            <Button type="button" variant="secondary" onClick={() => setRegenerateOpen(true)}>
              Regenerar cronograma
            </Button>
          )}
        </div>
      </header>

      <section className="grid gap-4 rounded-2xl border border-white/55 bg-white/55 p-4 text-sm text-slate-600 sm:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Capital</p>
          <p className="text-lg font-semibold text-slate-800">${loan.principal_amount.toLocaleString("es-CL")}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Total esperado</p>
          <p className="text-lg font-semibold text-slate-800">${(summary?.total_expected ?? 0).toLocaleString("es-CL")}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Pagado</p>
          <p className="text-lg font-semibold text-emerald-600">${(summary?.total_paid ?? 0).toLocaleString("es-CL")}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Saldo</p>
          <p className="text-lg font-semibold text-rose-600">${(summary?.remaining_amount ?? 0).toLocaleString("es-CL")}</p>
        </div>
      </section>

      <LoanScheduleTable
        schedules={schedules}
        onRegisterPayment={onRegisterPayment}
        onUnlinkPayment={onUnlinkPayment}
        canManage={canManage}
      />

      {loan.notes && (
        <div className="rounded-2xl border border-white/55 bg-white/55 p-4 text-sm text-slate-600">
          <p className="text-xs uppercase tracking-wide text-slate-400">Notas</p>
          <p>{loan.notes}</p>
        </div>
      )}

      <Modal isOpen={regenerateOpen} onClose={() => setRegenerateOpen(false)} title="Regenerar cronograma">
        <form onSubmit={handleRegenerate} className="space-y-4">
          <Input
            label="Nuevo total de cuotas"
            type="number"
            value={regenerateForm.totalInstallments ?? loan.total_installments}
            onChange={(event) =>
              setRegenerateForm((prev) => ({ ...prev, totalInstallments: Number(event.target.value) }))
            }
            min={1}
            max={360}
          />
          <Input
            label="Nueva fecha de inicio"
            type="date"
            value={regenerateForm.startDate ?? loan.start_date}
            onChange={(event) =>
              setRegenerateForm((prev) => ({ ...prev, startDate: event.target.value }))
            }
          />
          <Input
            label="Tasa de interés (%)"
            type="number"
            value={regenerateForm.interestRate ?? loan.interest_rate}
            onChange={(event) =>
              setRegenerateForm((prev) => ({ ...prev, interestRate: Number(event.target.value) }))
            }
            min={0}
            step="0.01"
          />
          <Input
            label="Frecuencia"
            type="select"
            value={regenerateForm.frequency ?? loan.frequency}
            onChange={(event) =>
              setRegenerateForm((prev) => ({
                ...prev,
                frequency: event.target.value as RegenerateSchedulePayload["frequency"],
              }))
            }
          >
            <option value="WEEKLY">Semanal</option>
            <option value="BIWEEKLY">Quincenal</option>
            <option value="MONTHLY">Mensual</option>
          </Input>
          {regenerateError && (
            <p className="rounded-lg bg-rose-100 px-4 py-2 text-sm text-rose-700">{regenerateError}</p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setRegenerateOpen(false)} disabled={regenerating}>
              Cancelar
            </Button>
            <Button type="submit" disabled={regenerating}>
              {regenerating ? "Actualizando..." : "Regenerar"}
            </Button>
          </div>
        </form>
      </Modal>

      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/40 backdrop-blur-sm">
          <p className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-primary)] shadow">
            Cargando préstamo...
          </p>
        </div>
      )}
    </section>
  );
}

export default LoanDetail;
