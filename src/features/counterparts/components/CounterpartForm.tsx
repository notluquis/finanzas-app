import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatRut } from "../../../lib/rut";
import Button from "../../../components/Button";
import Input from "../../../components/Input";
import Alert from "../../../components/Alert";
import type {
  Counterpart,
  CounterpartPersonType,
  CounterpartCategory,
} from "../types";
import { CATEGORY_OPTIONS, EMPTY_FORM } from "../constants";

interface CounterpartFormProps {
  counterpart?: Counterpart | null;
  onSave: (payload: any) => Promise<void>;
  error: string | null;
  saving: boolean;
}

type CounterpartFormState = {
  rut: string;
  name: string;
  personType: CounterpartPersonType;
  category: CounterpartCategory;
  email: string;
  notes: string;
};

export default function CounterpartForm({
  counterpart,
  onSave,
  error,
  saving,
}: CounterpartFormProps) {
  const [form, setForm] = useState<CounterpartFormState>(EMPTY_FORM);

  useEffect(() => {
    if (counterpart) {
      setForm({
        rut: counterpart.rut ?? "",
        name: counterpart.name,
        personType: counterpart.personType,
        category: counterpart.category,
        email: counterpart.email ?? "",
        notes: counterpart.notes ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [counterpart]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      rut: form.rut.trim() || null,
      name: form.name.trim(),
      personType: form.personType,
      category: form.category,
      email: form.email.trim() || null,
      employeeEmail: form.email.trim() || null,
      notes: form.notes.trim() || null,
    };
    await onSave(payload);
  };

  return (
    <section className="glass-card glass-underlay-gradient space-y-5 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-[var(--brand-primary)] drop-shadow-sm">
          {counterpart ? "Editar contraparte" : "Nueva contraparte"}
        </h1>
        <p className="text-xs text-slate-600/90">
          Completa los datos principales para sincronizar la información de pagos y retiros.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <Input
          label="RUT"
          type="text"
          value={form.rut}
          onChange={(event) => setForm((prev) => ({ ...prev, rut: event.target.value }))}
          placeholder="12.345.678-9"
          helper={form.rut ? formatRut(form.rut) : undefined}
        />
        <Input
          label="Nombre"
          type="text"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Allos Chile Spa"
          required
        />
        <Input
          label="Tipo de persona"
          type="select"
          value={form.personType}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, personType: event.target.value as CounterpartPersonType }))
          }
        >
          <option value="PERSON">Persona natural</option>
          <option value="COMPANY">Empresa</option>
          <option value="OTHER">Otra</option>
        </Input>
        <Input
          label="Clasificación"
          type="select"
          value={form.category}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, category: event.target.value as CounterpartCategory }))
          }
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Input>
        {form.category === "EMPLOYEE" && (
          <p className="md:col-span-2 text-[11px] text-slate-500/80">
            Se vinculará como empleado utilizando el correo electrónico ingresado.
          </p>
        )}
        <Input
          label="Correo electrónico"
          type="email"
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          placeholder="contacto@empresa.cl"
        />
        <Input
          label="Notas"
          type="textarea"
          rows={4}
          value={form.notes}
          onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          placeholder="Información adicional, persona de contacto, etc."
          className="md:col-span-2"
        />
        {counterpart?.employeeId && (
          <p className="md:col-span-2 text-xs text-slate-500/80">
            Empleado vinculado (ID #{counterpart.employeeId}).{" "}
            <Link to="/employees" className="font-semibold text-[var(--brand-primary)]">
              Ver empleados
            </Link>
          </p>
        )}
        <div className="md:col-span-2 flex flex-col gap-3">
          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
