import React, { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { createEmployee, updateEmployee } from "../api";
import type { Employee } from "../types";
import Button from "../../../components/Button";
import Input from "../../../components/Input";
import Alert from "../../../components/Alert";

const EMPTY_FORM = {
  full_name: "",
  role: "",
  email: "",
  hourly_rate: "0",
  overtime_rate: "",
  retention_rate: "0.145",
};

interface EmployeeFormProps {
  employee?: Employee | null;
  onSave: () => void;
  onCancel: () => void;
}

export default function EmployeeForm({ employee, onSave, onCancel }: EmployeeFormProps) {
  const { hasRole } = useAuth();
  const canEdit = hasRole("GOD", "ADMIN");

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (employee) {
      setForm({
        full_name: employee.full_name,
        role: employee.role,
        email: employee.email ?? "",
        hourly_rate: String(employee.hourly_rate),
        overtime_rate: employee.overtime_rate != null ? String(employee.overtime_rate) : "",
        retention_rate: String(employee.retention_rate),
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [employee]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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
      if (employee?.id) {
        await updateEmployee(employee.id, payload);
      } else {
        await createEmployee(payload);
      }
      onSave();
      onCancel();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar el empleado";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-[var(--brand-primary)]/15 bg-white p-6 text-sm shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Input
          label="Nombre completo"
          type="text"
          value={form.full_name}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
          required
        />
        <Input
          label="Cargo"
          type="text"
          value={form.role}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, role: event.target.value }))}
          required
        />
        <Input
          label="Correo"
          type="email"
          value={form.email}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          placeholder="correo@bioalergia.cl"
        />
        <Input
          label="Valor hora (CLP)"
          type="number"
          min="0"
          value={form.hourly_rate}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, hourly_rate: event.target.value }))}
          required
        />
        <Input
          label="Valor hora extra (CLP)"
          type="number"
          min="0"
          value={form.overtime_rate}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, overtime_rate: event.target.value }))}
          placeholder="Automático 1.5x"
        />
        <Input
          label="Retención (%)"
          type="number"
          min="0"
          max="1"
          step="0.001"
          value={form.retention_rate}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, retention_rate: event.target.value }))}
          required
          helper="Ej: 0.145 para 14.5%"
        />
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : employee?.id ? "Actualizar" : "Agregar"}
        </Button>
        {employee?.id && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar edición
          </Button>
        )}
      </div>
    </form>
  );
}
