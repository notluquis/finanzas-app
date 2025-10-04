import React, { useEffect } from "react";
import { z } from "zod";
import { useAuth } from "../../../context/AuthContext";
import { createEmployee, updateEmployee } from "../api";
import { useForm } from "../../../hooks/useForm";
import type { Employee } from "../types";
import Button from "../../../components/Button";
import Input from "../../../components/Input";
import { formatRut, normalizeRut } from "../../../lib/rut";
import Alert from "../../../components/Alert";

const employeeFormSchema = z.object({
  full_name: z.string().trim().min(1, "El nombre completo es requerido"),
  role: z.string().trim().min(1, "El cargo es requerido"),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  rut: z.string().trim().max(20).optional().or(z.literal("")),
  bank_name: z.string().trim().max(120).optional().or(z.literal("")),
  bank_account_type: z.string().trim().max(32).optional().or(z.literal("")),
  bank_account_number: z.string().trim().max(64).optional().or(z.literal("")),
  hourly_rate: z.coerce.number().min(0, "La tarifa por hora debe ser mayor o igual a 0"),
  overtime_rate: z.coerce.number().min(0, "La tarifa de horas extra debe ser mayor o igual a 0").optional(),
  retention_rate: z.coerce.number().min(0).max(1, "La tasa de retención debe estar entre 0 y 1"),
});

type EmployeeFormData = z.infer<typeof employeeFormSchema>;

const INITIAL_VALUES: EmployeeFormData = {
  full_name: "",
  role: "",
  email: "",
  rut: "",
  bank_name: "",
  bank_account_type: "",
  bank_account_number: "",
  hourly_rate: 0,
  overtime_rate: undefined,
  retention_rate: 0.145,
};

interface EmployeeFormProps {
  employee?: Employee | null;
  onSave: () => void;
  onCancel: () => void;
}

export default function EmployeeForm({ employee, onSave, onCancel }: EmployeeFormProps) {
  const { hasRole } = useAuth();
  const canEdit = hasRole("GOD", "ADMIN");

  const form = useForm({
    initialValues: INITIAL_VALUES,
    validationSchema: employeeFormSchema,
    onSubmit: async (values) => {
      if (!canEdit) return;

      const payload = {
        full_name: values.full_name,
        role: values.role,
        email: values.email || null,
        rut: values.rut || null,
        bank_name: values.bank_name || null,
        bank_account_type: values.bank_account_type || null,
        bank_account_number: values.bank_account_number || null,
        hourly_rate: values.hourly_rate,
        overtime_rate: values.overtime_rate || null,
        retention_rate: values.retention_rate,
      };

      if (employee?.id) {
        await updateEmployee(employee.id, payload);
      } else {
        await createEmployee(payload);
      }
      onSave();
      onCancel();
    },
    validateOnBlur: true,
    validateOnChange: false,
  });

  // Update form when employee changes
  useEffect(() => {
    if (employee) {
      form.setValue("full_name", employee.full_name);
      form.setValue("role", employee.role);
      form.setValue("email", employee.email ?? "");
      form.setValue("rut", employee.rut ?? "");
      form.setValue("bank_name", employee.bank_name ?? "");
      form.setValue("bank_account_type", employee.bank_account_type ?? "");
      form.setValue("bank_account_number", employee.bank_account_number ?? "");
      form.setValue("hourly_rate", employee.hourly_rate);
      form.setValue("overtime_rate", employee.overtime_rate);
      form.setValue("retention_rate", employee.retention_rate);
    } else {
      form.reset();
    }
  }, [employee]);

  return (
    <form
      onSubmit={form.handleSubmit}
      className="space-y-4 rounded-2xl border border-[var(--brand-primary)]/15 bg-white p-6 text-sm shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <Input
            label="Nombre completo"
            type="text"
            {...form.getFieldProps("full_name")}
            required
          />
          {form.getFieldError("full_name") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("full_name")}</p>
          )}
        </div>

        <div>
          <Input
            label="Cargo"
            type="text"
            {...form.getFieldProps("role")}
            required
          />
          {form.getFieldError("role") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("role")}</p>
          )}
        </div>

        <div>
          <Input
            label="Correo"
            type="email"
            {...form.getFieldProps("email")}
          />
          {form.getFieldError("email") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("email")}</p>
          )}
        </div>

        <div>
          <Input
            label="RUT"
            type="text"
            placeholder="12.345.678-9"
            {...form.getFieldProps("rut")}
            onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
              const v = e.target.value.trim();
              if (v) form.setValue("rut", formatRut(normalizeRut(v) ?? v));
            }}
          />
        </div>
        <div>
          <Input label="Banco" type="text" placeholder="BancoEstado" {...form.getFieldProps("bank_name")} />
        </div>
        <div>
          <Input
            label="Tipo de cuenta"
            type="select"
            value={form.values.bank_account_type || ""}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => form.setValue("bank_account_type", e.target.value || "")}
          >
            <option value="">Selecciona…</option>
            <option value="RUT">RUT</option>
            <option value="VISTA">VISTA</option>
            <option value="CORRIENTE">CORRIENTE</option>
            <option value="AHORRO">AHORRO</option>
          </Input>
        </div>
        <div>
          <Input label="N° de cuenta" type="text" placeholder="12345678" {...form.getFieldProps("bank_account_number")} />
        </div>

        <div>
          <Input
            label="Tarifa por hora ($)"
            type="number"
            step="0.01"
            min="0"
            {...form.getFieldProps("hourly_rate")}
          />
          {form.getFieldError("hourly_rate") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("hourly_rate")}</p>
          )}
        </div>

        <div>
          <Input
            label="Tarifa horas extra ($)"
            type="number"
            step="0.01"
            min="0"
            {...form.getFieldProps("overtime_rate")}
          />
          {form.getFieldError("overtime_rate") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("overtime_rate")}</p>
          )}
        </div>

        <div>
          <Input
            label="Tasa retención (0-1)"
            type="number"
            step="0.001"
            min="0"
            max="1"
            {...form.getFieldProps("retention_rate")}
          />
          {form.getFieldError("retention_rate") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("retention_rate")}</p>
          )}
        </div>
      </div>

      {!form.isValid && Object.keys(form.errors).length > 0 && (
        <Alert variant="error">
          Por favor corrige los errores en el formulario antes de continuar.
        </Alert>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={form.isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!canEdit || form.isSubmitting}>
          {form.isSubmitting ? "Guardando..." : employee ? "Actualizar" : "Crear"}
        </Button>
      </div>
    </form>
  );
}