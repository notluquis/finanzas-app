import { useState, useMemo, useCallback } from "react";

export type SortDirection = "asc" | "desc";

export interface SortState<T = string> {
  column: T | null;
  direction: SortDirection;
}

export interface UseSortingOptions<T> {
  initialColumn?: T | null;
  initialDirection?: SortDirection;
}

export function useSorting<T extends string>({
  initialColumn = null,
  initialDirection = "asc",
}: UseSortingOptions<T> = {}) {
  const [sortState, setSortState] = useState<SortState<T>>({
    column: initialColumn,
    direction: initialDirection,
  });

  const sort = useCallback((column: T) => {
    setSortState(prev => {
      if (prev.column === column) {
        // Cycle: asc -> desc -> none
        if (prev.direction === "asc") {
          return { column, direction: "desc" };
        } else if (prev.direction === "desc") {
          return { column: null, direction: "asc" };
        }
      }
      return { column, direction: "asc" };
    });
  }, []);

  const getSortIcon = useCallback((column: T) => {
    if (sortState.column !== column) return "↕️";
    return sortState.direction === "asc" ? "↑" : "↓";
  }, [sortState]);

  const getSortProps = useCallback((column: T) => ({
    onClick: () => sort(column),
    style: { cursor: "pointer" },
    title: `Ordenar por ${column}`,
  }), [sort]);

  return {
    sortState,
    sort,
    getSortIcon,
    getSortProps,
  };
}