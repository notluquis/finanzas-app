import type {
  Counterpart,
  CounterpartAccount,
  CounterpartDetail,
  CounterpartAccountSuggestion,
  CounterpartSummary,
  CounterpartPersonType,
  CounterpartCategory,
} from "./types";

const JSON_HEADERS = { "Content-Type": "application/json" };

async function handleResponse<T>(res: Response) {
  const data = await res.json();
  if (!res.ok || data.status !== "ok") {
    throw new Error(data.message || "No se pudo completar la operación");
  }
  return data as { status: "ok" } & T;
}

export async function fetchCounterparts() {
  const res = await fetch("/api/counterparts", { credentials: "include" });
  const data = await handleResponse<{ counterparts: Counterpart[] }>(res);
  return data.counterparts;
}

export async function fetchCounterpart(id: number) {
  const res = await fetch(`/api/counterparts/${id}`, { credentials: "include" });
  const data = await handleResponse<{ counterpart: Counterpart; accounts: CounterpartAccount[] }>(res);
  return data;
}

export async function createCounterpart(payload: {
  rut?: string | null;
  name: string;
  personType: CounterpartPersonType;
  category: CounterpartCategory;
  email?: string | null;
  employeeEmail?: string | null;
  notes?: string | null;
}) {
  const res = await fetch("/api/counterparts", {
    method: "POST",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ counterpart: Counterpart; accounts: CounterpartAccount[] }>(res);
  return data;
}

export async function updateCounterpart(id: number, payload: Partial<{
  rut: string | null;
  name: string;
  personType: CounterpartPersonType;
  category: CounterpartCategory;
  email: string | null;
  employeeEmail: string | null;
  notes: string | null;
}>) {
  const res = await fetch(`/api/counterparts/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ counterpart: Counterpart; accounts: CounterpartAccount[] }>(res);
  return data;
}

export async function addCounterpartAccount(
  counterpartId: number,
  payload: {
    accountIdentifier: string;
    bankName?: string | null;
    accountType?: string | null;
    holder?: string | null;
    concept?: string | null;
    metadata?: {
      bankAccountNumber?: string | null;
      withdrawId?: string | null;
    } | null;
  }
) {
  const res = await fetch(`/api/counterparts/${counterpartId}/accounts`, {
    method: "POST",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ accounts: CounterpartAccount[] }>(res);
  return data.accounts;
}

export async function updateCounterpartAccount(
  accountId: number,
  payload: Partial<{
    bankName: string | null;
    accountType: string | null;
    holder: string | null;
    concept: string | null;
  }>
) {
  const res = await fetch(`/api/counterparts/accounts/${accountId}`, {
    method: "PUT",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  await handleResponse(res);
}

export async function fetchAccountSuggestions(query: string, limit = 10) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("limit", String(limit));
  const res = await fetch(`/api/counterparts/suggestions?${params.toString()}`, {
    credentials: "include",
  });
  const data = await handleResponse<{ suggestions: CounterpartAccountSuggestion[] }>(res);
  return data.suggestions;
}

export async function fetchCounterpartSummary(
  counterpartId: number,
  params?: { from?: string; to?: string }
) {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  const res = await fetch(`/api/counterparts/${counterpartId}/summary${search.size ? `?${search.toString()}` : ""}`, {
    credentials: "include",
  });
  const data = await handleResponse<{ summary: CounterpartSummary }>(res);
  return data.summary;
}

export async function attachCounterpartRut(counterpartId: number, rut: string) {
  const res = await fetch(`/api/counterparts/${counterpartId}/attach-rut`, {
    method: "POST",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify({ rut }),
  });
  const data = await handleResponse<{ accounts: CounterpartAccount[] }>(res);
  return data.accounts;
}
