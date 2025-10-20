import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as Toast from "@radix-ui/react-toast";

import Alert from "../components/Alert";
import Button from "../components/Button";
import Input from "../components/Input";
import Checkbox from "../components/Checkbox";
import { classifyCalendarEvent, fetchUnclassifiedCalendarEvents } from "../features/calendar/api";
import type { CalendarUnclassifiedEvent } from "../features/calendar/types";

dayjs.locale("es");

const CATEGORY_CHOICES = ["Tratamiento subcutáneo", "Test y exámenes"];
const TREATMENT_STAGE_CHOICES = ["Mantención", "Inducción"];

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  minimumFractionDigits: 0,
});

const classificationSchema = z.object({
  category: z.string().optional(),
  amountExpected: z.string().optional(),
  amountPaid: z.string().optional(),
  attended: z.boolean(),
  dosage: z.string().optional(),
  treatmentStage: z.string().optional(),
});

const classificationArraySchema = z.object({
  entries: z.array(classificationSchema),
});

type FormValues = z.infer<typeof classificationArraySchema>;

type ParsedPayload = {
  category: string | null;
  amountExpected: number | null;
  amountPaid: number | null;
  attended: boolean | null;
  dosage: string | null;
  treatmentStage: string | null;
};

function eventKey(event: Pick<CalendarUnclassifiedEvent, "calendarId" | "eventId">) {
  return `${event.calendarId}:::${event.eventId}`;
}

function formatEventDate(event: CalendarUnclassifiedEvent) {
  if (event.startDateTime) {
    const start = dayjs(event.startDateTime);
    if (event.endDateTime) {
      const end = dayjs(event.endDateTime);
      return `${start.format("DD MMM YYYY HH:mm")} – ${end.format("HH:mm")}`;
    }
    return start.format("DD MMM YYYY HH:mm");
  }
  if (event.startDate) {
    const start = dayjs(event.startDate);
    if (event.endDate && event.endDate !== event.startDate) {
      const end = dayjs(event.endDate);
      return `${start.format("DD MMM YYYY")} – ${end.format("DD MMM YYYY")}`;
    }
    return start.format("DD MMM YYYY");
  }
  return "Sin fecha";
}

function parseAmountInput(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(/[^0-9]/g, "");
  if (!normalized.length) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildDefaultEntry(event: CalendarUnclassifiedEvent) {
  return {
    category: event.category ?? "",
    amountExpected: event.amountExpected != null ? String(event.amountExpected) : "",
    amountPaid: event.amountPaid != null ? String(event.amountPaid) : "",
    attended: event.attended ?? false,
    dosage: event.dosage ?? "",
    treatmentStage: event.treatmentStage ?? "",
  };
}

function buildPayload(entry: z.infer<typeof classificationSchema>, event: CalendarUnclassifiedEvent): ParsedPayload {
  const category = entry.category?.trim() || null;
  const resolvedCategory = category ?? event.category ?? null;
  const amountExpected = parseAmountInput(entry.amountExpected) ?? event.amountExpected ?? null;
  const amountPaid = parseAmountInput(entry.amountPaid) ?? event.amountPaid ?? null;
  const attended = entry.attended ?? event.attended ?? null;
  const dosage = entry.dosage?.trim() ? entry.dosage.trim() : null;
  const treatmentStage =
    resolvedCategory === "Tratamiento subcutáneo" && entry.treatmentStage?.trim() ? entry.treatmentStage.trim() : null;

  return {
    category: resolvedCategory,
    amountExpected,
    amountPaid,
    attended,
    dosage,
    treatmentStage,
  };
}

function CalendarClassificationPage() {
  const [events, setEvents] = useState<CalendarUnclassifiedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(classificationArraySchema),
    defaultValues: { entries: [] },
    mode: "onChange",
  });

  const { control, reset, getValues, setValue, watch } = form;
  const { fields } = useFieldArray({ control, name: "entries" });
  const watchedEntries = watch("entries", []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUnclassifiedCalendarEvents(100);
      setEvents(data);
      reset({ entries: data.map(buildDefaultEntry) });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron obtener los eventos pendientes";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const pendingCount = events.length;

  const totals = useMemo(() => {
    if (!watchedEntries || !watchedEntries.length) return { expected: 0, paid: 0 };
    return watchedEntries.reduce(
      (acc, entry, index) => {
        const event = events[index];
        if (!event) return acc;
        const expected = parseAmountInput(entry?.amountExpected) ?? event.amountExpected ?? 0;
        const paid = parseAmountInput(entry?.amountPaid) ?? event.amountPaid ?? 0;
        return {
          expected: acc.expected + expected,
          paid: acc.paid + paid,
        };
      },
      { expected: 0, paid: 0 }
    );
  }, [watchedEntries, events]);

  const handleResetEntry = useCallback(
    (index: number, event: CalendarUnclassifiedEvent) => {
      setValue(`entries.${index}`, buildDefaultEntry(event), { shouldDirty: true });
    },
    [setValue]
  );

  const handleSave = useCallback(
    async (event: CalendarUnclassifiedEvent, index: number) => {
      const key = eventKey(event);
      setSavingKey(key);
      setError(null);
      try {
        const values = getValues(`entries.${index}` as const);
        const payload = buildPayload(values, event);
        await classifyCalendarEvent({
          calendarId: event.calendarId,
          eventId: event.eventId,
          category: payload.category,
          amountExpected: payload.amountExpected,
          amountPaid: payload.amountPaid,
          attended: payload.attended,
          dosage: payload.dosage,
          treatmentStage: payload.treatmentStage,
        });
        setToastMessage("Clasificación actualizada");
        setToastOpen(true);
        await loadEvents();
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudo guardar la clasificación";
        if (err instanceof Error) {
          console.error("[calendar:classify] error", err);
        }
        setError(message);
      } finally {
        setSavingKey(null);
      }
    },
    [getValues, loadEvents]
  );

  return (
    <Toast.Provider swipeDirection="right">
      <Tooltip.Provider delayDuration={200}>
        <section className="space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Clasificar eventos pendientes</h1>
            <p className="text-sm text-slate-600">
              Revisa los eventos que no pudieron clasificarse automáticamente. Asigna la categoría correcta, confirma
              montos y marca si la persona asistió.
            </p>
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <span className="inline-flex cursor-help items-center gap-1 text-[11px] text-slate-500">
                  ¿Cómo se clasifica?
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[9px] text-slate-500">
                    i
                  </span>
                </span>
              </Tooltip.Trigger>
              <Tooltip.Content
                className="rounded-md bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
                side="bottom"
                align="start"
              >
                Usa “Tratamiento subcutáneo” para vacunas (vac, clustoid) y “Test y exámenes” para paneles o multitest.
                <Tooltip.Arrow className="fill-slate-900" />
              </Tooltip.Content>
            </Tooltip.Root>
          </header>

          <div className="glass-card glass-underlay-gradient grid gap-4 rounded-2xl border border-white/60 p-4 text-xs shadow-sm sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pendientes</p>
              <p className="mt-1 text-xl font-semibold text-[var(--brand-primary)]">{pendingCount}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Monto esperado sugerido
              </p>
              <p className="mt-1 text-xl font-semibold text-[var(--brand-primary)]">
                {currencyFormatter.format(totals.expected)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Monto pagado sugerido</p>
              <p className="mt-1 text-xl font-semibold text-[var(--brand-primary)]">
                {currencyFormatter.format(totals.paid)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => void loadEvents()} disabled={loading}>
              {loading ? "Actualizando..." : "Recargar lista"}
            </Button>
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          {!loading && events.length === 0 && !error && (
            <Alert variant="success">No hay eventos pendientes de clasificar. ¡Buen trabajo!</Alert>
          )}

          <div className="space-y-4">
            {fields.map((field, index) => {
              const event = events[index];
              if (!event) return null;
              const entry = watchedEntries?.[index] ?? buildDefaultEntry(event);
              const key = eventKey(event);
              const isSubcutaneous = (entry.category || "") === "Tratamiento subcutáneo";
              const description = event.description?.trim();

              return (
                <article
                  key={field.id}
                  className="glass-card glass-underlay-gradient space-y-4 rounded-2xl border border-white/60 bg-white/80 p-5 text-sm shadow-sm"
                >
                  <header className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-secondary)]/70">
                        {event.calendarId}
                      </span>
                      <h2 className="text-lg font-semibold text-slate-800">{event.summary ?? "(Sin título)"}</h2>
                      <span className="text-xs text-slate-500">{formatEventDate(event)}</span>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-[11px] text-slate-500">
                      {event.eventType && (
                        <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                          {event.eventType}
                        </span>
                      )}
                      {event.category && (
                        <span className="rounded-full bg-[var(--brand-secondary)]/15 px-2 py-1 font-semibold text-[var(--brand-secondary)]">
                          {event.category}
                        </span>
                      )}
                    </div>
                  </header>

                  {description && (
                    <p className="rounded-xl bg-white/70 p-3 text-xs text-slate-600 shadow-inner">
                      <span className="font-semibold text-slate-700">Descripción:</span>{" "}
                      <span className="whitespace-pre-wrap">{description}</span>
                    </p>
                  )}

                  <div className="grid gap-4 text-xs text-slate-600 md:grid-cols-6">
                    <Controller
                      control={control}
                      name={`entries.${index}.category` as const}
                      render={({ field: formField }) => (
                        <Input
                          label="Clasificación"
                          type="select"
                          value={formField.value ?? ""}
                          onChange={(event: ChangeEvent<HTMLSelectElement>) => formField.onChange(event.target.value)}
                        >
                          <option value="">Sin clasificación</option>
                          {CATEGORY_CHOICES.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </Input>
                      )}
                    />
                    <Controller
                      control={control}
                      name={`entries.${index}.amountExpected` as const}
                      render={({ field: formField }) => (
                        <Input
                          label="Monto esperado"
                          type="text"
                          placeholder="50000"
                          value={formField.value ?? ""}
                          onChange={(event: ChangeEvent<HTMLInputElement>) => formField.onChange(event.target.value)}
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name={`entries.${index}.amountPaid` as const}
                      render={({ field: formField }) => (
                        <Input
                          label="Monto pagado"
                          type="text"
                          placeholder="50000"
                          value={formField.value ?? ""}
                          onChange={(event: ChangeEvent<HTMLInputElement>) => formField.onChange(event.target.value)}
                        />
                      )}
                    />
                    {isSubcutaneous && (
                      <Controller
                        control={control}
                        name={`entries.${index}.dosage` as const}
                        render={({ field: formField }) => (
                          <Input
                            label="Dosis"
                            placeholder="0.3 ml"
                            value={formField.value ?? ""}
                            onChange={(event: ChangeEvent<HTMLInputElement>) => formField.onChange(event.target.value)}
                          />
                        )}
                      />
                    )}
                    {isSubcutaneous && (
                      <Controller
                        control={control}
                        name={`entries.${index}.treatmentStage` as const}
                        render={({ field: formField }) => (
                          <Input
                            label="Etapa tratamiento"
                            type="select"
                            value={formField.value ?? ""}
                            onChange={(event: ChangeEvent<HTMLSelectElement>) => formField.onChange(event.target.value)}
                          >
                            <option value="">Sin etapa</option>
                            {TREATMENT_STAGE_CHOICES.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </Input>
                        )}
                      />
                    )}
                    <Controller
                      control={control}
                      name={`entries.${index}.attended` as const}
                      render={({ field: formField }) => (
                        <div className="flex items-end">
                          <Checkbox
                            label="Asistió / llegó"
                            checked={formField.value ?? false}
                            onChange={(event) => formField.onChange(event.target.checked)}
                          />
                        </div>
                      )}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" onClick={() => handleSave(event, index)} disabled={savingKey === key}>
                      {savingKey === key ? "Guardando..." : "Guardar y continuar"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleResetEntry(index, event)}
                      disabled={savingKey === key}
                    >
                      Limpiar cambios
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </Tooltip.Provider>
      <Toast.Root
        className="rounded-lg bg-slate-900/90 px-4 py-3 text-sm text-white shadow-lg"
        open={toastOpen && Boolean(toastMessage)}
        onOpenChange={setToastOpen}
      >
        <Toast.Title className="font-semibold">Operación completada</Toast.Title>
        <Toast.Description className="text-xs text-slate-200">{toastMessage}</Toast.Description>
      </Toast.Root>
      <Toast.Viewport className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" />
    </Toast.Provider>
  );
}

export default CalendarClassificationPage;
