import Button from "../../../components/Button";
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
      className="glass-card glass-underlay-gradient grid gap-4 p-6 text-xs text-slate-600 lg:grid-cols-4"
    >
      <label className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Fecha desde</span>
        <input
          type="date"
          value={filters.from}
          onChange={(event) => onChange({ from: event.target.value })}
          className="glass-input"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Fecha hasta</span>
        <input
          type="date"
          value={filters.to}
          onChange={(event) => onChange({ to: event.target.value })}
          className="glass-input"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Descripción</span>
        <input
          type="text"
          value={filters.description}
          onChange={(event) => onChange({ description: event.target.value })}
          className="glass-input"
          placeholder="Contiene..."
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-slate-500">ID transacción</span>
        <input
          type="text"
          value={filters.sourceId}
          onChange={(event) => onChange({ sourceId: event.target.value })}
          className="glass-input"
          placeholder="SOURCE_ID"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Desde</span>
        <input
          type="text"
          value={filters.origin}
          onChange={(event) => onChange({ origin: event.target.value })}
          className="glass-input"
          placeholder="Origen"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Hacia</span>
        <input
          type="text"
          value={filters.destination}
          onChange={(event) => onChange({ destination: event.target.value })}
          className="glass-input"
          placeholder="Destino"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-slate-500">Tipo</span>
        <select
          value={filters.direction}
          onChange={(event) => onChange({ direction: event.target.value as Filters["direction"] })}
          className="glass-input"
        >
          <option value="">Todos</option>
          <option value="IN">Ingreso</option>
          <option value="OUT">Egreso</option>
          <option value="NEUTRO">Neutro</option>
        </select>
      </label>
      <div className="flex items-end">
        <Button type="submit" disabled={loading} size="sm">
          {loading ? "Filtrando..." : "Aplicar filtros"}
        </Button>
      </div>
    </form>
  );
}
