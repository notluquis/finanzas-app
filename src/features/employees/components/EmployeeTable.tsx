import { useMemo } from "react";
import { fmtCLP } from "../../../lib/format";
import { useAuth } from "../../../context/AuthContext";
import type { Employee } from "../types";
import Button from "../../../components/Button";
import Alert from "../../../components/Alert";

interface EmployeeTableProps {
  employees: Employee[];
  loading: boolean;
  onEdit: (employee: Employee) => void;
  onDeactivate: (id: number) => void;
  onActivate: (id: number) => void;
}

export default function EmployeeTable({
  employees,
  loading,
  onEdit,
  onDeactivate,
  onActivate,
}: EmployeeTableProps) {
  const { hasRole } = useAuth();
  const canEdit = hasRole("GOD", "ADMIN");

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status === "ACTIVE"),
    [employees]
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--brand-primary)]/15 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Nombre</th>
            <th className="px-4 py-3 text-left font-semibold">Cargo</th>
            <th className="px-4 py-3 text-left font-semibold">Correo</th>
            <th className="px-4 py-3 text-left font-semibold">Hora base</th>
            <th className="px-4 py-3 text-left font-semibold">Hora extra</th>
            <th className="px-4 py-3 text-left font-semibold">Retención</th>
            <th className="px-4 py-3 text-left font-semibold">Estado</th>
            {canEdit && <th className="px-4 py-3 text-right font-semibold">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id} className="odd:bg-slate-50/60">
              <td className="px-4 py-3 font-medium text-slate-700">{employee.full_name}</td>
              <td className="px-4 py-3 text-slate-600">{employee.role}</td>
              <td className="px-4 py-3 text-slate-500">{employee.email ?? "—"}</td>
              <td className="px-4 py-3 text-slate-600">{fmtCLP(employee.hourly_rate)}</td>
              <td className="px-4 py-3 text-slate-600">
                {employee.overtime_rate != null ? fmtCLP(employee.overtime_rate) : "Automático"}
              </td>
              <td className="px-4 py-3 text-slate-600">{(employee.retention_rate * 100).toFixed(1)}%</td>
              <td className="px-4 py-3 text-slate-600">{employee.status === "ACTIVE" ? "Activo" : "Inactivo"}</td>
              {canEdit && (
                <td className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                  <Button variant="secondary" onClick={() => onEdit(employee)} className="mr-3">
                    Editar
                  </Button>
                  {employee.status === "ACTIVE" ? (
                    <Button variant="secondary" onClick={() => onDeactivate(employee.id)}>
                      Desactivar
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={() => onActivate(employee.id)}>
                      Activar
                    </Button>
                  )}
                </td>
              )}
            </tr>
          ))}
          {!employees.length && !loading && (
            <tr>
              <td colSpan={canEdit ? 7 : 6} className="px-4 py-6 text-center text-slate-500">
                No hay registros.
              </td>
            </tr>
          )}
          {loading && (
            <tr>
              <td colSpan={canEdit ? 7 : 6} className="px-4 py-6 text-center text-[var(--brand-primary)]">
                Cargando...
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {!activeEmployees.length && !loading && (
        <Alert variant="error">
          Registra a tu primer trabajador para habilitar la captura de horas.
        </Alert>
      )}
    </div>
  );
}
