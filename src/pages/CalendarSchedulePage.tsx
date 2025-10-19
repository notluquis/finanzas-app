import { useMemo } from "react";
import type { ChangeEvent } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { useTranslation } from "react-i18next";

import Button from "../components/Button";
import Input from "../components/Input";
import Alert from "../components/Alert";
import { MultiSelectFilter, type MultiSelectOption } from "../features/calendar/components/MultiSelectFilter";
import { useCalendarEvents } from "../features/calendar/hooks/useCalendarEvents";
import ScheduleCalendar from "../features/calendar/components/ScheduleCalendar";

dayjs.locale("es");

const numberFormatter = new Intl.NumberFormat("es-CL");
const NULL_EVENT_TYPE_VALUE = "__NULL__";
const NULL_CATEGORY_VALUE = "__NULL_CATEGORY__";

function CalendarSchedulePage() {
  const { t } = useTranslation("calendar");
  const {
    filters,
    daily,
    summary,
    loading,
    error,
    isDirty,
    availableCalendars,
    availableEventTypes,
    availableCategories,
    updateFilters,
    applyFilters,
    resetFilters,
  } = useCalendarEvents();

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

  const allEvents = useMemo(() => daily?.days.flatMap((day) => day.events) ?? [], [daily?.days]);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)]">{t("scheduleTitle")}</h1>
        <p className="text-sm text-slate-600">{t("scheduleDescription")}</p>
      </header>

      <form
        className="glass-card glass-underlay-gradient grid gap-4 rounded-2xl border border-[var(--brand-primary)]/15 bg-white/80 p-6 text-xs text-slate-600 shadow-sm md:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters();
        }}
      >
        <Input
          label={t("filters.from")}
          type="date"
          value={filters.from}
          onChange={(event: ChangeEvent<HTMLInputElement>) => updateFilters("from", event.target.value)}
        />
        <Input
          label={t("filters.to")}
          type="date"
          value={filters.to}
          onChange={(event: ChangeEvent<HTMLInputElement>) => updateFilters("to", event.target.value)}
        />
        <MultiSelectFilter
          label={t("filters.calendars")}
          options={calendarOptions}
          selected={filters.calendarIds}
          onToggle={(value) => {
            updateFilters(
              "calendarIds",
              filters.calendarIds.includes(value)
                ? filters.calendarIds.filter((id) => id !== value)
                : [...filters.calendarIds, value]
            );
          }}
          placeholder={t("filters.all")}
        />
        <MultiSelectFilter
          label={t("filters.eventTypes")}
          options={eventTypeOptions}
          selected={filters.eventTypes}
          onToggle={(value) => {
            updateFilters(
              "eventTypes",
              filters.eventTypes.includes(value)
                ? filters.eventTypes.filter((id) => id !== value)
                : [...filters.eventTypes, value]
            );
          }}
          placeholder={t("filters.all")}
        />
        <MultiSelectFilter
          label={t("filters.categories")}
          options={categoryOptions}
          selected={filters.categories}
          onToggle={(value) => {
            updateFilters(
              "categories",
              filters.categories.includes(value)
                ? filters.categories.filter((id) => id !== value)
                : [...filters.categories, value]
            );
          }}
          placeholder={t("filters.allCategories")}
        />
        <Input
          label={t("filters.search")}
          placeholder={t("searchPlaceholder")}
          value={filters.search}
          onChange={(event: ChangeEvent<HTMLInputElement>) => updateFilters("search", event.target.value)}
        />
        <div className="flex items-end gap-2 md:col-span-2">
          <Button type="submit" disabled={loading}>
            {loading ? t("loading") : t("applyFilters")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={loading || !isDirty}
            onClick={() => {
              resetFilters();
            }}
          >
            {t("resetFilters")}
          </Button>
        </div>
      </form>

      {error && <Alert variant="error">{error}</Alert>}

      <ScheduleCalendar events={allEvents} loading={loading} />

      {summary && (
        <p className="text-xs text-slate-500">
          {t("activeRange", {
            from: dayjs(summary.filters.from).format("DD MMM YYYY"),
            to: dayjs(summary.filters.to).format("DD MMM YYYY"),
            events: numberFormatter.format(allEvents.length),
          })}
        </p>
      )}
    </section>
  );
}

export default CalendarSchedulePage;
