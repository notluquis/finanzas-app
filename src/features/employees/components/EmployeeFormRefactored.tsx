import React, { useEffect } from "react";
import { z } from "zod";
import { useAuth } from "../../../context/AuthContext";
import { createEmployee, updateEmployee } from "../api";
import { useForm } from "../../../hooks/useForm";
import type { Employee } from "../types";
import Button from "../../../components/Button";
import Input from "../../../components/Input";
import Alert from "../../../components/Alert";

const employeeFormSchema = z.object({
  full_name: z.string().trim().min(1, "El nombre completo es requerido"),
  role: z.string().trim().min(1, "El cargo es requerido"),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  hourly_rate: z.coerce.number().min(0, "La tarifa por hora debe ser mayor o igual a 0"),
  overtime_rate: z.coerce.number().min(0, "La tarifa de horas extra debe ser mayor o igual a 0").optional(),
  retention_rate: z.coerce.number().min(0).max(1, "La tasa de retención debe estar entre 0 y 1"),
});

type EmployeeFormData = z.infer<typeof employeeFormSchema>;

const INITIAL_VALUES: EmployeeFormData = {
  full_name: "",
  role: "",
  email: "",
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