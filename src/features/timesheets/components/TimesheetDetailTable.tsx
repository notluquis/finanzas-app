import dayjs from "dayjs";
import { useAuth } from "../../../context/AuthContext";
import Button from "../../../components/Button";
import Input from "../../../components/Input";
import { computeStatus, hasRowData, isRowDirty, parseDuration, computeExtraAmount, formatDateLabel } from "../utils";
import type { BulkRow, TimesheetEntry } from "../types";
import type { Employee } from "../../employees/types";

interface TimesheetDetailTableProps {
  bulkRows: BulkRow[];
  initialRows: BulkRow[];
  loadingDetail: boolean;
  selectedEmployee: Employee | null;
  onRowChange: (index: number, field: keyof Omit<BulkRow, "date" | "entryId">, value: string) => void;
  onResetRow: (index: number) => void;
  onRemoveEntry: (row: BulkRow) => void;
  onBulkSave: () => void;
  saving: boolean;
  pendingCount: number;
  modifiedCount: number;
  monthLabel: string;
  employeeOptions: Employee[];
  setSelectedEmployeeId: (id: number) => void;
}

export default function TimesheetDetailTable({
  bulkRows,
  initialRows,
  loadingDetail,
  selectedEmployee,
  onRowChange,
  onResetRow,
  onRemoveEntry,
  onBulkSave,
  saving,
  pendingCount,
  modifiedCount,
  monthLabel,
  employeeOptions,
  setSelectedEmployeeId,
}: TimesheetDetailTableProps) {
  const { hasRole } = useAuth();
  const canEdit = hasRole("GOD", "ADMIN", "ANALYST");

  return (
    <div className="space-y-4 glass-card glass-underlay-gradient p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--brand-primary)]">Detalle diario</h2>
          <p className="text-xs text-slate-500">
            {selectedEmployee?.id
              ? `Registros de ${monthLabel}`
              : "Selecciona un trabajador en el resumen"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>Pendientes: {pendingCount}</span>
          <span>Cambios sin guardar: {modifiedCount}</span>
          {employeeOptions.length > 0 && (
            <select
              value={selectedEmployee?.id ?? ""}
              onChange={(event) => setSelectedEmployeeId(Number(event.target.value))}
              className="rounded border px-3 py-2 text-sm"
            >
              {employeeOptions.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {canEdit && selectedEmployee?.id && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Ingresa las horas en formato <strong>HH:MM</strong> (24 horas). Déjalo en blanco para marcarlo como pendiente. Si limpias un registro existente, se eliminará al guardar.
          </p>
          <Button
            type="button"
            disabled={saving || (!modifiedCount && pendingCount === 0)}
            onClick={onBulkSave}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Fecha</th>
              <th className="px-3 py-2 text-left font-semibold">Horas (HH:MM)</th>
              <th className="px-3 py-2 text-left font-semibold">Horas extra (HH:MM)</th>
              <th className="px-3 py-2 text-left font-semibold">Horas pagadas adicional (HH:MM)</th>
              <th className="px-3 py-2 text-left font-semibold">Comentario</th>
              <th className="px-3 py-2 text-left font-semibold">Estado</th>
              {canEdit && <th className="px-3 py-2 text-right font-semibold">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {loadingDetail && (
              <tr>
                <td colSpan={canEdit ? 7 : 6} className="px-4 py-6 text-center text-[var(--brand-primary)]">
                  Cargando detalle...
                </td>
              </tr>
            )}
            {!loadingDetail &&
              bulkRows.map((row, index) => {
                const initial = initialRows[index];
                const dirty = isRowDirty(row, initial);
                const status = computeStatus(row, dirty);
                const statusColor =
                  status === "Registrado"
                    ? "text-emerald-600"
                    : status === "Pendiente"
                      ? "text-slate-400"
                      : status === "Sin guardar"
                        ? "text-amber-600"
                        : "text-slate-600";

                return (
                  <tr key={row.date} className="odd:bg-slate-50/60">
                    <td className="px-3 py-2 text-slate-600">{dayjs(row.date).format("DD-MM-YYYY")}</td>
                    <td className="px-3 py-2">
                      <Input
                        type="text"
                        placeholder="00:00"
                        value={row.worked}
                        onChange={(event) => onRowChange(index, "worked", event.target.value)}
                        className="w-full"
                        disabled={!canEdit}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="text"
                        placeholder="00:00"
                        value={row.overtime}
                        onChange={(event) => onRowChange(index, "overtime", event.target.value)}
                        className="w-full"
                        disabled={!canEdit}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        value={row.extra}
                        onChange={(event) => onRowChange(index, "extra", event.target.value)}
                        className="w-full"
                        disabled={!canEdit}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <textarea
                        rows={1}
                        value={row.comment}
                        onChange={(event) => onRowChange(index, "comment", event.target.value)}
                        className="w-full rounded border px-2 py-1 text-sm"
                        disabled={!canEdit}
                      />
                    </td>
                    <td className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide ${statusColor}`}>
                      {status}
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide">
                        <Button variant="secondary" onClick={() => onResetRow(index)} className="mr-3">
                          Revertir
                        </Button>
                        {row.entryId && (
                          <Button variant="secondary" onClick={() => onRemoveEntry(row)}>
                            Eliminar
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            {!loadingDetail && !bulkRows.length && (
              <tr>
                <td colSpan={canEdit ? 7 : 6} className="px-4 py-6 text-center text-slate-500">
                  {employeeOptions.length
                    ? "Selecciona un trabajador para ver o editar sus horas."
                    : "Registra a trabajadores activos para comenzar a cargar horas."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
