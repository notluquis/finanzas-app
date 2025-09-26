import type { ColumnKey } from "../constants";
import { COLUMN_DEFS } from "../constants";

type Props = {
  visibleColumns: Set<ColumnKey>;
  onToggle: (column: ColumnKey) => void;
};

export function TransactionsColumnToggles({ visibleColumns, onToggle }: Props) {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
      {COLUMN_DEFS.map((column) => (
        <label key={column.key} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={visibleColumns.has(column.key)}
            onChange={() => onToggle(column.key)}
          />
          {column.label}
        </label>
      ))}
    </div>
  );
}
