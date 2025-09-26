import { useEffect, useMemo, useState } from "react";
import { fmtCLP } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import {
  fetchEmployees,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
} from "../features/employees/api";
import type { Employee } from "../features/employees/types";

const EMPTY_FORM = {
  full_name: "",
  role: "",
  email: "",
  hourly_rate: "0",
  overtime_rate: "",
  retention_rate: "0.145",
};

export default function EmployeesPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("GOD", "ADMIN");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status === "ACTIVE"),
    [employees]
  );

  async function loadEmployees() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEmployees(includeInactive);
      setEmployees(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron cargar los empleados";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(employee: Employee) {
    setEditingId(employee.id);
    setForm({
      full_name: employee.full_name,
      role: employee.role,
      email: employee.email ?? "",
      hourly_rate: String(employee.hourly_rate),
      overtime_rate: employee.overtime_rate != null ? String(employee.overtime_rate) : "",
      retention_rate: String(employee.retention_rate),
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;

    const payload = {
      full_name: form.full_name.trim(),
      role: form.role.trim(),
      email: form.email.trim() || null,
      hourly_rate: Number(form.hourly_rate || 0),
      overtime_rate: form.overtime_rate ? Number(form.overtime_rate) : null,
      retention_rate: Number(form.retention_rate || 0),
    };

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateEmployee(editingId, payload);
      } else {
        await createEmployee(payload);
      }
      await loadEmployees();
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar el empleado";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: number) {
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    try {
      await deactivateEmployee(id);
      await loadEmployees();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el estado";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Equipo y tarifas</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Registra trabajadores, correos y tarifas para calcular automáticamente los totales mensuales.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
          />
          Ver inactivos
        </label>
      </div>

      {error && <p className="rounded-lg bg-rose-100 px-4 py-3 text-sm text-rose-700">{error}</p>}

      {canEdit && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-[var(--brand-primary)]/15 bg-white p-6 text-sm shadow-sm"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Nombre completo
              <input
                type="text"
                value={form.full_name}
                onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
                required
                className="rounded border px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cargo
              <input
                type="text"
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
                required
                className="rounded border px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Correo
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                className="rounded border px-3 py-2"
                placeholder="correo@bioalergia.cl"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Valor hora (CLP)
              <input
                type="number"
                min="0"
                value={form.hourly_rate}
                onChange={(event) => setForm((prev) => ({ ...prev, hourly_rate: event.target.value }))}
                required
                className="rounded border px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Valor hora extra (CLP)
              <input
                type="number"
                min="0"
                value={form.overtime_rate}
                onChange={(event) => setForm((prev) => ({ ...prev, overtime_rate: event.target.value }))}
                className="rounded border px-3 py-2"
                placeholder="Automático 1.5x"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Retención (%)
              <input
                type="number"
                min="0"
                max="1"
                step="0.001"
                value={form.retention_rate}
                onChange={(event) => setForm((prev) => ({ ...prev, retention_rate: event.target.value }))}
                required
                className="rounded border px-3 py-2"
              />
              <span className="text-[11px] text-slate-400">Ej: 0.145 para 14.5%</span>
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed"
            >
              {saving ? "Guardando..." : editingId ? "Actualizar" : "Agregar"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Cancelar edición
              </button>
            )}
          </div>
        </form>
      )}

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
                    <button
                      type="button"
                      onClick={() => handleEdit(employee)}
                      className="mr-3 text-[var(--brand-primary)]"
                    >
                      Editar
                    </button>
                    {employee.status === "ACTIVE" ? (
                      <button
                        type="button"
                        onClick={() => handleDeactivate(employee.id)}
                        className="text-rose-600"
                      >
                        Desactivar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => updateEmployee(employee.id, { status: "ACTIVE" })}
                        className="text-emerald-600"
                      >
                        Activar
                      </button>
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
      </div>

      {!activeEmployees.length && !loading && (
        <p className="rounded-lg bg-amber-100 px-4 py-3 text-sm text-amber-700">
          Registra a tu primer trabajador para habilitar la captura de horas.
        </p>
      )}
    </section>
  );
}
