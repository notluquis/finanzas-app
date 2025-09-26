import type { Filters } from "../types";

type TransactionsFiltersProps = {
  filters: Filters;
  loading: boolean;
  onChange: (update: Partial<Filters>) => void;
  onSubmit: () => void;
};

export function TransactionsFilters({ filters, loading, onChange, onSubmit }: TransactionsFiltersProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="grid gap-4 rounded-2xl border border-[var(--brand-primary)]/10 bg-white p-6 text-xs text-slate-600 shadow-sm lg:grid-cols-4"
    >
      <label className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Fecha desde</span>
        <input
          type="date"
          value={filters.from}
          onChange={(event) => onChange({ from: event.target.value })}
          className="rounded border px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Fecha hasta</span>
        <input
          type="date"
          value={filters.to}
          onChange={(event) => onChange({ to: event.target.value })}
          className="rounded border px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Descripción</span>
        <input
          type="text"
          value={filters.description}
          onChange={(event) => onChange({ description: event.target.value })}
          className="rounded border px-2 py-1"
          placeholder="Contiene..."
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-slate-500">ID transacción</span>
        <input
          type="text"
          value={filters.sourceId}
          onChange={(event) => onChange({ sourceId: event.target.value })}
          className="rounded border px-2 py-1"
          placeholder="SOURCE_ID"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Desde</span>
        <input
          type="text"
          value={filters.origin}
          onChange={(event) => onChange({ origin: event.target.value })}
          className="rounded border px-2 py-1"
          placeholder="Origen"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Hacia</span>
        <input
          type="text"
          value={filters.destination}
          onChange={(event) => onChange({ destination: event.target.value })}
          className="rounded border px-2 py-1"
          placeholder="Destino"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Tipo</span>
        <select
          value={filters.direction}
          onChange={(event) => onChange({ direction: event.target.value as Filters["direction"] })}
          className="rounded border px-2 py-1"
        >
          <option value="">Todos</option>
          <option value="IN">Ingreso</option>
          <option value="OUT">Egreso</option>
          <option value="NEUTRO">Neutro</option>
        </select>
      </label>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white shadow disabled:cursor-not-allowed"
        >
          {loading ? "Filtrando..." : "Aplicar filtros"}
        </button>
      </div>
    </form>
  );
}
