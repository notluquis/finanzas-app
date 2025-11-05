import { useEffect, useState } from "react";

export function useMonths(employeeId?: number | null) {
  const [months, setMonths] = useState<string[]>([]);
  const [monthsWithData, setMonthsWithData] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (employeeId != null) {
      params.set("employeeId", String(employeeId));
    }

    const url = `/api/timesheets/months${params.toString() ? `?${params.toString()}` : ""}`;

    fetch(url, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "ok" && Array.isArray(data.months) && data.months.length > 0) {
          setMonths(data.months);
          setMonthsWithData(new Set(data.monthsWithData || []));
        } else {
          // Fallback local: 6 meses atrás + mes actual + 3 adelante
          const now = new Date();
          const pad = (n: number) => String(n).padStart(2, "0");
          const fallback = Array.from({ length: 10 }).map((_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - 6 + i, 1);
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
          });
          setMonths(fallback);
        }
      })
      .catch(() => {
        // Fallback on error
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const fallback = Array.from({ length: 10 }).map((_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - 6 + i, 1);
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
        });
        setMonths(fallback);
        setError("No se pudieron cargar los meses");
      })
      .finally(() => setLoading(false));
  }, [employeeId]);

  return { months, monthsWithData, loading, error };
}
