import { useMemo } from "react";
import type { ChangeEvent } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";

import Input from "../components/Input";
import Button from "../components/Button";
import Alert from "../components/Alert";
import { MultiSelectFilter, type MultiSelectOption } from "../features/calendar/components/MultiSelectFilter";
import { useCalendarEvents } from "../features/calendar/hooks/useCalendarEvents";
import type { CalendarEventDetail, CalendarDayEvents } from "../features/calendar/types";

dayjs.locale("es");

const numberFormatter = new Intl.NumberFormat("es-CL");
const currencyFormatter = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 });
const NULL_EVENT_TYPE_VALUE = "__NULL__";
const NULL_CATEGORY_VALUE = "__NULL_CATEGORY__";

const formatEventTime = (event: CalendarEventDetail) => {
  if (event.startDateTime) {
    const start = dayjs(event.startDateTime);
    const end = event.endDateTime ? dayjs(event.endDateTime) : null;
    return end ? `${start.format("HH:mm")} – ${end.format("HH:mm")}` : start.format("HH:mm");
  }
  if (event.startDate) return "Todo el día";
  return "Sin horario";
};

function CalendarDailyPage() {
  const {
    filters,
    daily,
    loading,
    error,
    availableCalendars,
    availableEventTypes,
    availableCategories,
    updateFilters,
    applyFilters,
    resetFilters,
  } = useCalendarEvents();

  const totals = useMemo(
    () => ({
      days: daily?.totals.days ?? 0,
      events: daily?.totals.events ?? 0,
      amountExpected: daily?.totals.amountExpected ?? 0,
      amountPaid: daily?.totals.amountPaid ?? 0,
    }),
    [daily?.totals.amountExpected, daily?.totals.amountPaid, daily?.totals.days, daily?.totals.events]
  );

  const toggleCalendar = (calendarId: string) => {
    updateFilters(
      "calendarIds",
      filters.calendarIds.includes(calendarId)
        ? filters.calendarIds.filter((id) => id !== calendarId)
        : [...filters.calendarIds, calendarId]
    );
  };

  const toggleEventType = (value: string) => {
    updateFilters(
      "eventTypes",
      filters.eventTypes.includes(value)
        ? filters.eventTypes.filter((id) => id !== value)
        : [...filters.eventTypes, value]
    );
  };

  const toggleCategory = (value: string) => {
    updateFilters(
      "categories",
      filters.categories.includes(value)
        ? filters.categories.filter((id) => id !== value)
        : [...filters.categories, value]
    );
  };

  const calendarOptions: MultiSelectOption[] = useMemo(
    () =>
      availableCalendars.map((entry) => ({
        value: entry.calendarId,
        label: `${entry.calendarId} · ${numberFormatter.format(entry.total)}`,
      })),
    [availableCalendars]
  );

  const eventTypeOptions: MultiSelectOption[] = useMemo(
    () =>
      availableEventTypes.map((entry) => {
        const value = entry.eventType ?? NULL_EVENT_TYPE_VALUE;
        const label = entry.eventType ?? "Sin tipo";
        return { value, label: `${label} · ${numberFormatter.format(entry.total)}` };
      }),
    [availableEventTypes]
  );

  const categoryOptions: MultiSelectOption[] = useMemo(
    () =>
      availableCategories.map((entry) => {
        const value = entry.category ?? NULL_CATEGORY_VALUE;
        const label = entry.category ?? "Sin clasificación";
        return { value, label: `${label} · ${numberFormatter.format(entry.total)}` };
      }),
    [availableCategories]
  );

  const handleMaxDaysChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number.parseInt(event.target.value, 10);
    if (Number.isNaN(parsed)) {
      updateFilters("maxDays", 1);
      return;
    }
    const bounded = Math.min(Math.max(parsed, 1), 120);
    updateFilters("maxDays", bounded);
  };
  const renderDay = (entry: CalendarDayEvents, defaultOpen = false) => (
    <details
      key={entry.date}
      className="rounded-2xl border border-white/60 bg-white/85 p-4 text-sm text-slate-700 shadow-sm"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 font-semibold text-[var(--brand-primary)]">
        <span>{dayjs(entry.date).format("dddd DD MMM YYYY")}</span>
        <span className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>
            {numberFormatter.format(entry.total)} evento{entry.total === 1 ? "" : "s"}
          </span>
          <span className="hidden sm:inline">·</span>
          <span>Esperado {currencyFormatter.format(entry.amountExpected ?? 0)}</span>
          <span className="hidden sm:inline">·</span>
          <span>Pagado {currencyFormatter.format(entry.amountPaid ?? 0)}</span>
        </span>
      </summary>
      <div className="mt-3 space-y-3">
        {entry.events.map((event) => (
          <article
            key={event.eventId}
            className="rounded-2xl border border-white/50 bg-white/95 p-4 text-sm text-slate-700 shadow-inner"
          >
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold text-slate-800">
                  {event.summary?.trim() || "(Sin título)"}
                </h3>
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-secondary)]/70">
                  {formatEventTime(event)}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1 text-[11px] text-slate-500">
                <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                  {event.calendarId}
                </span>
                {event.category && (
                  <span className="rounded-full bg-[var(--brand-secondary)]/15 px-2 py-1 font-semibold text-[var(--brand-secondary)]">
                    {event.category}
                  </span>
                )}
                {event.eventType && (
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-500">
                    {event.eventType}
                  </span>
                )}
              </div>
            </header>

            <dl className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
              {[
                { label: "Estado", value: event.status },
                { label: "Transparencia", value: event.transparency },
                { label: "Visibilidad", value: event.visibility },
                { label: "Color", value: event.colorId },
                { label: "Zona horaria", value: event.startTimeZone ?? event.endTimeZone },
                {
                  label: "Monto esperado",
                  value: event.amountExpected != null ? currencyFormatter.format(event.amountExpected) : null,
                },
                {
                  label: "Monto pagado",
                  value: event.amountPaid != null ? currencyFormatter.format(event.amountPaid) : null,
                },
                {
                  label: "Asistencia",
                  value:
                    event.attended == null ? null : event.attended ? "Asistió" : "No asistió",
                },
                {
                  label: "Creado",
                  value: event.eventCreatedAt ? dayjs(event.eventCreatedAt).format("DD MMM YYYY HH:mm") : null,
                },
                {
                  label: "Actualizado",
                  value: event.eventUpdatedAt ? dayjs(event.eventUpdatedAt).format("DD MMM YYYY HH:mm") : null,
                },
              ]
                .filter((entry) => entry.value)
                .map((entry) => (
                  <div key={entry.label} className="flex flex-col">
                    <dt className="font-semibold text-slate-600">{entry.label}</dt>
                    <dd className="text-slate-500">{entry.value}</dd>
                  </div>
                ))}
            </dl>

            {event.location && (
              <p className="mt-3 text-xs text-slate-500">
                <span className="font-semibold text-slate-600">Ubicación:</span> {event.location}
              </p>
            )}

            {event.hangoutLink && (
              <p className="mt-2 text-xs">
                <a
                  href={event.hangoutLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--brand-primary)] underline"
                >
                  Enlace de videollamada
                </a>
              </p>
            )}

            {event.description && (
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{event.description}</p>
            )}

            {event.rawEvent != null && (
              <details className="mt-3 text-xs text-slate-500">
                <summary className="cursor-pointer font-semibold text-[var(--brand-primary)]">Ver payload completo</summary>
                <pre className="mt-2 max-h-64 overflow-x-auto rounded-lg bg-slate-900/90 p-3 text-[10px] text-white">
                  {JSON.stringify(event.rawEvent, null, 2)}
                </pre>
              </details>
            )}
          </article>
        ))}
      </div>
    </details>
  );

  const todayKey = dayjs().format("YYYY-MM-DD");
  const tomorrowKey = dayjs().add(1, "day").format("YYYY-MM-DD");

  const todayEntry = daily?.days.find((day) => day.date === todayKey) ?? null;
  const tomorrowEntry = daily?.days.find((day) => day.date === tomorrowKey) ?? null;

  const usedDates = new Set<string>();
  if (todayEntry) usedDates.add(todayEntry.date);
  if (tomorrowEntry) usedDates.add(tomorrowEntry.date);

  const pastDays = (daily?.days ?? [])
    .filter((day) => !usedDates.has(day.date) && dayjs(day.date).isBefore(dayjs(todayKey)))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const futureBeyond = (daily?.days ?? [])
    .filter((day) => !usedDates.has(day.date) && dayjs(day.date).isAfter(dayjs(tomorrowKey)))
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Detalle diario de eventos</h1>
        <p className="text-sm text-slate-600">
          Revisa el detalle de cada jornada con los eventos sincronizados. Los días aparecen colapsados para que puedas
          expandir solo los que te interesen.
        </p>
      </header>

      <form
        className="glass-card glass-underlay-gradient grid gap-4 rounded-2xl border border-[var(--brand-primary)]/15 bg-white/80 p-6 text-xs text-slate-600 shadow-sm md:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters();
        }}
      >
        <Input
          label="Desde"
          type="date"
          value={filters.from}
          onChange={(event: ChangeEvent<HTMLInputElement>) => updateFilters("from", event.target.value)}
        />
        <Input
          label="Hasta"
          type="date"
          value={filters.to}
          onChange={(event: ChangeEvent<HTMLInputElement>) => updateFilters("to", event.target.value)}
        />
        <MultiSelectFilter
          label="Calendarios"
          options={calendarOptions}
          selected={filters.calendarIds}
          onToggle={toggleCalendar}
          placeholder="Todos"
        />
        <MultiSelectFilter
          label="Tipos de evento"
          options={eventTypeOptions}
          selected={filters.eventTypes}
          onToggle={toggleEventType}
          placeholder="Todos"
        />
        <MultiSelectFilter
          label="Clasificación"
          options={categoryOptions}
          selected={filters.categories}
          onToggle={toggleCategory}
          placeholder="Todas"
        />
        <Input
          label="Buscar"
          placeholder="Título o descripción"
          value={filters.search}
          onChange={(event: ChangeEvent<HTMLInputElement>) => updateFilters("search", event.target.value)}
        />
        <Input
          label="Días a listar"
          type="number"
          min={1}
          max={120}
          value={filters.maxDays}
          onChange={handleMaxDaysChange}
        />
        <div className="flex items-end gap-2 md:col-span-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Actualizando..." : "Aplicar filtros"}
          </Button>
          <Button type="button" variant="secondary" onClick={resetFilters} disabled={loading}>
            Reestablecer
          </Button>
        </div>
      </form>

      {error && <Alert variant="error">{error}</Alert>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass-card glass-underlay-gradient rounded-2xl border border-white/60 p-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Días listados</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--brand-primary)]">
            {numberFormatter.format(totals.days)}
          </p>
        </div>
        <div className="glass-card glass-underlay-gradient rounded-2xl border border-white/60 p-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Eventos listados</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--brand-primary)]">
            {numberFormatter.format(totals.events)}
          </p>
        </div>
        <div className="glass-card glass-underlay-gradient rounded-2xl border border-white/60 p-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monto esperado</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--brand-primary)]">
            {currencyFormatter.format(totals.amountExpected)}
          </p>
        </div>
        <div className="glass-card glass-underlay-gradient rounded-2xl border border-white/60 p-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monto pagado</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--brand-primary)]">
            {currencyFormatter.format(totals.amountPaid)}
          </p>
        </div>
      </section>

      {loading && <p className="text-sm text-slate-500">Cargando eventos...</p>}
      {!loading && daily && daily.days.length === 0 && (
        <Alert variant="warning">No se encontraron eventos con los filtros seleccionados.</Alert>
      )}

      <div className="space-y-5">
        {todayEntry && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Hoy</h2>
            {renderDay(todayEntry, true)}
          </section>
        )}

        {tomorrowEntry && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Mañana</h2>
            {renderDay(tomorrowEntry)}
          </section>
        )}

        {futureBeyond.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Próximos días</h2>
            <div className="space-y-3">
              {futureBeyond.map((entry) => renderDay(entry))}
            </div>
          </section>
        )}

        {pastDays.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Días anteriores</h2>
            <div className="space-y-3">
              {pastDays.map((entry) => renderDay(entry))}
            </div>
          </section>
        )}
      </div>
    </section>
  );
}

export default CalendarDailyPage;
