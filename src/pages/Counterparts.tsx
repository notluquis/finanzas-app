import { Link } from "react-router-dom";
import { Fragment, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  addCounterpartAccount,
  attachCounterpartRut,
  createCounterpart,
  fetchAccountSuggestions,
  fetchCounterpart,
  fetchCounterpartSummary,
  fetchCounterparts,
  updateCounterpart,
  updateCounterpartAccount,
} from "../features/counterparts/api";
import type {
  Counterpart,
  CounterpartAccount,
  CounterpartAccountSuggestion,
  CounterpartPersonType,
  CounterpartCategory,
  CounterpartSummary,
} from "../features/counterparts/types";
import type { DbMovement } from "../features/transactions/types";
import { fmtCLP } from "../lib/format";
import { formatRut } from "../lib/rut";

type CounterpartForm = {
  rut: string;
  name: string;
  personType: CounterpartPersonType;
  category: CounterpartCategory;
  email: string;
  notes: string;
};

const EMPTY_FORM: CounterpartForm = {
  rut: "",
  name: "",
  personType: "COMPANY",
  category: "SUPPLIER",
  email: "",
  notes: "",
};

type AccountForm = {
  accountIdentifier: string;
  bankName: string;
  accountType: string;
  holder: string;
  concept: string;
  bankAccountNumber: string;
};

const ACCOUNT_FORM_DEFAULT: AccountForm = {
  accountIdentifier: "",
  bankName: "",
  accountType: "",
  holder: "",
  concept: "",
  bankAccountNumber: "",
};

const CATEGORY_OPTIONS: Array<{ value: CounterpartCategory; label: string }> = [
  { value: "SUPPLIER", label: "Proveedor" },
  { value: "PATIENT", label: "Paciente" },
  { value: "EMPLOYEE", label: "Empleado" },
  { value: "PARTNER", label: "Socio" },
  { value: "RELATED", label: "Relacionado a socio" },
  { value: "OTHER", label: "Otro" },
];

const CATEGORY_LABELS = CATEGORY_OPTIONS.reduce<Record<string, string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const SUMMARY_RANGE_MONTHS = 6;

type AccountTransactionsState = {
  expanded: boolean;
  loading: boolean;
  error: string | null;
  rows: DbMovement[];
};

type TransactionsApiResponse = {
  status: "ok" | "error";
  data: DbMovement[];
  message?: string;
};

type AccountGroup = {
  key: string;
  label: string;
  bankName: string | null;
  holder: string | null;
  concept: string;
  accounts: CounterpartAccount[];
};

export default function CounterpartsPage() {
  const [counterparts, setCounterparts] = useState<Counterpart[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ counterpart: Counterpart; accounts: CounterpartAccount[] } | null>(null);
  const [form, setForm] = useState<CounterpartForm>(EMPTY_FORM);
  const [formStatus, setFormStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState<AccountForm>(ACCOUNT_FORM_DEFAULT);
  const [accountStatus, setAccountStatus] = useState<"idle" | "saving">("idle");
  const [accountSuggestions, setAccountSuggestions] = useState<CounterpartAccountSuggestion[]>([]);
  const [suggestionQuery, setSuggestionQuery] = useState("");
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [attachLoading, setAttachLoading] = useState(false);
  const [accountDetails, setAccountDetails] = useState<Record<string, AccountTransactionsState>>({});

  const [summaryRange, setSummaryRange] = useState<{ from: string; to: string }>(() => ({
    from: dayjs().subtract(SUMMARY_RANGE_MONTHS, "month").startOf("month").format("YYYY-MM-DD"),
    to: dayjs().endOf("month").format("YYYY-MM-DD"),
  }));
  const [summary, setSummary] = useState<CounterpartSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const list = await fetchCounterparts();
      setCounterparts(list);
      if (list.length) {
        selectCounterpart(list[0].id);
      }
    }
    load().catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    if (!suggestionQuery.trim()) {
      setAccountSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const id = window.setTimeout(() => {
      setSuggestionsLoading(true);
      fetchAccountSuggestions(suggestionQuery).then(setAccountSuggestions).catch(() => undefined).finally(() => {
        if (!controller.signal.aborted) setSuggestionsLoading(false);
      });
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
  }, [suggestionQuery]);

  useEffect(() => {
    if (selectedId) {
      loadSummary(selectedId, summaryRange.from, summaryRange.to).catch((err) =>
        setError(err instanceof Error ? err.message : String(err))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, summaryRange.from, summaryRange.to]);

  useEffect(() => {
    setAccountDetails({});
  }, [selectedId, summaryRange.from, summaryRange.to]);

  async function selectCounterpart(id: number | null) {
    setError(null);
    setSummary(null);
    setDetail(null);
    setSelectedId(id);
    setAccountDetails({});
    if (!id) {
      setForm(EMPTY_FORM);
      setAccountForm(ACCOUNT_FORM_DEFAULT);
      setAccountSuggestions([]);
      setSuggestionQuery("");
      return;
    }
    try {
      const data = await fetchCounterpart(id);
      setDetail(data);
      setForm({
        rut: data.counterpart.rut ?? "",
        name: data.counterpart.name,
        personType: data.counterpart.personType,
        category: data.counterpart.category,
        email: data.counterpart.email ?? "",
        notes: data.counterpart.notes ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSaveCounterpart() {
    setFormStatus("saving");
    setError(null);
    const payload = {
      rut: form.rut.trim() || null,
      name: form.name.trim(),
      personType: form.personType,
      category: form.category,
      email: form.email.trim() || null,
      employeeEmail: form.email.trim() || null,
      notes: form.notes.trim() || null,
    };
    try {
      if (!payload.name) {
        throw new Error("El nombre es obligatorio");
      }
      let id = selectedId;
      if (id) {
        const data = await updateCounterpart(id, payload);
        setDetail(data);
        id = data.counterpart.id;
        setCounterparts((prev) =>
          prev
            .map((item) => (item.id === id ? data.counterpart : item))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
        setForm({
          rut: data.counterpart.rut ?? "",
          name: data.counterpart.name,
          personType: data.counterpart.personType,
          category: data.counterpart.category,
          email: data.counterpart.email ?? "",
          notes: data.counterpart.notes ?? "",
        });
      } else {
        const data = await createCounterpart(payload);
        setDetail(data);
        id = data.counterpart.id;
        setCounterparts((prev) => [...prev, data.counterpart].sort((a, b) => a.name.localeCompare(b.name)));
        setForm({
          rut: data.counterpart.rut ?? "",
          name: data.counterpart.name,
          personType: data.counterpart.personType,
          category: data.counterpart.category,
          email: data.counterpart.email ?? "",
          notes: data.counterpart.notes ?? "",
        });
      }
      setSelectedId(id);
      if (id) {
        await loadSummary(id, summaryRange.from, summaryRange.to);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFormStatus("idle");
    }
  }

  async function handleAddAccount() {
    if (!selectedId) {
      setError("Guarda la contraparte antes de agregar cuentas");
      return;
    }
    if (!accountForm.accountIdentifier.trim()) {
      setError("Ingresa un identificador de cuenta");
      return;
    }
    setAccountStatus("saving");
    setError(null);
    try {
      const accounts = await addCounterpartAccount(selectedId, {
        accountIdentifier: accountForm.accountIdentifier.trim(),
        bankName: accountForm.bankName.trim() || null,
        accountType: accountForm.accountType.trim() || null,
        holder: accountForm.holder.trim() || null,
        concept: accountForm.concept.trim() || null,
        metadata: {
          bankAccountNumber: accountForm.bankAccountNumber.trim() || null,
          withdrawId: accountForm.accountIdentifier.trim(),
        },
      });
      setDetail((prev) => (prev ? { counterpart: prev.counterpart, accounts } : prev));
      setAccountForm(ACCOUNT_FORM_DEFAULT);
      setAccountSuggestions([]);
      setSuggestionQuery("");
      await loadSummary(selectedId, summaryRange.from, summaryRange.to);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAccountStatus("idle");
    }
  }

  async function handleGroupConceptChange(group: AccountGroup, concept: string) {
    const trimmed = concept.trim();
    const nextConcept = trimmed || null;
    setError(null);
    try {
      await Promise.all(
        group.accounts.map((account) => updateCounterpartAccount(account.id, { concept: nextConcept }))
      );
      const groupIds = new Set(group.accounts.map((account) => account.id));
      setDetail((prev) =>
        prev
          ? {
              counterpart: prev.counterpart,
              accounts: prev.accounts.map((account) =>
                groupIds.has(account.id) ? { ...account, concept: nextConcept } : account
              ),
            }
          : prev
      );
      if (selectedId) {
        await loadSummary(selectedId, summaryRange.from, summaryRange.to);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function loadSummary(counterpartId: number, from: string, to: string) {
    setSummaryLoading(true);
    try {
      const data = await fetchCounterpartSummary(counterpartId, { from, to });
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSummaryLoading(false);
    }
  }

  function handleSuggestionClick(suggestion: CounterpartAccountSuggestion) {
    setAccountForm({
      accountIdentifier: suggestion.accountIdentifier,
      bankName: suggestion.bankName ?? "",
      accountType: suggestion.accountType ?? "",
      holder: suggestion.holder ?? "",
      concept: suggestion.assignedCounterpartId ? "" : "",
      bankAccountNumber: suggestion.bankAccountNumber ?? "",
    });
    setSuggestionQuery(suggestion.accountIdentifier);
    if (!selectedId) {
      setForm((prev) => ({
        ...prev,
        rut: suggestion.rut ?? prev.rut,
        name: suggestion.holder ?? prev.name,
      }));
    }
  }

  function handleSuggestionCreate(suggestion: CounterpartAccountSuggestion) {
    setForm((prev) => ({
      ...prev,
      rut: suggestion.rut ?? prev.rut,
      name: suggestion.holder ?? prev.name,
      category: prev.category,
    }));
    setAccountForm({
      accountIdentifier: suggestion.accountIdentifier,
      bankName: suggestion.bankName ?? "",
      accountType: suggestion.accountType ?? "",
      holder: suggestion.holder ?? "",
      concept: "",
      bankAccountNumber: suggestion.bankAccountNumber ?? "",
    });
    setSuggestionQuery(suggestion.accountIdentifier);
  }

  async function handleAttachRut(rut: string | null | undefined) {
    if (!selectedId) {
      setError("Selecciona una contraparte para vincular");
      return;
    }
    if (!rut) {
      setError("La sugerencia no contiene un RUT válido");
      return;
    }
    setAttachLoading(true);
    setError(null);
    try {
      await attachCounterpartRut(selectedId, rut);
      const updated = await fetchCounterpart(selectedId);
      setDetail(updated);
      setAccountSuggestions([]);
      setCounterparts((prev) =>
        prev
          .map((item) => (item.id === selectedId ? updated.counterpart : item))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setForm({
        rut: updated.counterpart.rut ?? "",
        name: updated.counterpart.name,
        personType: updated.counterpart.personType,
        category: updated.counterpart.category,
        email: updated.counterpart.email ?? "",
        notes: updated.counterpart.notes ?? "",
      });
      await loadSummary(selectedId, summaryRange.from, summaryRange.to);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAttachLoading(false);
    }
  }

  const accountGrouping = useMemo(() => {
    const groups = new Map<string, AccountGroup>();
    const identifierToKey = new Map<string, string>();

    (detail?.accounts ?? []).forEach((account) => {
      const label = account.metadata?.bankAccountNumber?.trim() || account.account_identifier;
      identifierToKey.set(account.account_identifier, label);
      const existing = groups.get(label);
      if (existing) {
        existing.accounts.push(account);
        if (!existing.bankName && account.bank_name) existing.bankName = account.bank_name;
        if (!existing.holder && account.holder) existing.holder = account.holder;
        if (!existing.concept && account.concept) existing.concept = account.concept;
      } else {
        groups.set(label, {
          key: label,
          label,
          bankName: account.bank_name ?? null,
          holder: account.holder ?? null,
          concept: account.concept ?? "",
          accounts: [account],
        });
      }
    });

    const accountGroups = Array.from(groups.values())
      .map((group) => ({
        ...group,
        concept: group.concept ?? "",
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));

    return { accountGroups, identifierToKey };
  }, [detail?.accounts]);

  const accountGroups = accountGrouping.accountGroups;
  const identifierToGroupKey = accountGrouping.identifierToKey;

  const summaryByGroup = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    summary?.byAccount.forEach((row) => {
      const key = identifierToGroupKey.get(row.account_identifier) ?? row.account_identifier;
      const entry = map.get(key) ?? { total: 0, count: 0 };
      entry.total += row.total;
      entry.count += row.count;
      map.set(key, entry);
    });
    return map;
  }, [summary, identifierToGroupKey]);

  function resolveSourceId(account: CounterpartAccount) {
    return account.metadata?.withdrawId?.trim() || account.account_identifier;
  }

  async function fetchTransactionsBySourceId(sourceId: string) {
    const params = new URLSearchParams();
    params.set("sourceId", sourceId);
    params.set("direction", "OUT");
    params.set("includeAmounts", "true");
    params.set("page", "1");
    params.set("pageSize", "200");
    if (summaryRange.from) params.set("from", summaryRange.from);
    if (summaryRange.to) params.set("to", summaryRange.to);

    const res = await fetch(`/api/transactions?${params.toString()}`, { credentials: "include" });
    const payload = (await res.json()) as TransactionsApiResponse;
    if (!res.ok || payload.status !== "ok") {
      throw new Error(payload.message || "No se pudieron obtener los movimientos");
    }
    return payload.data;
  }

  async function fetchGroupTransactions(group: AccountGroup) {
    const uniqueSourceIds = Array.from(new Set(group.accounts.map((account) => resolveSourceId(account))));
    const results = await Promise.all(uniqueSourceIds.map((sourceId) => fetchTransactionsBySourceId(sourceId)));
    const merged = results.flat();
    const dedup = new Map<number, DbMovement>();
    merged.forEach((movement) => {
      if (!dedup.has(movement.id)) {
        dedup.set(movement.id, movement);
      }
    });
    return Array.from(dedup.values()).sort((a, b) => dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf());
  }

  async function toggleAccountDetails(group: AccountGroup) {
    const identifier = group.key;
    const current = accountDetails[identifier];
    const nextExpanded = !(current?.expanded);
    setAccountDetails((prev) => ({
      ...prev,
      [identifier]: {
        expanded: nextExpanded,
        loading: nextExpanded && !(current?.rows?.length),
        error: null,
        rows: current?.rows ?? [],
      },
    }));
    if (nextExpanded && (!current || current.rows.length === 0)) {
      try {
        const rows = await fetchGroupTransactions(group);
        setAccountDetails((prev) => ({
          ...prev,
          [identifier]: {
            expanded: true,
            loading: false,
            error: null,
            rows,
          },
        }));
      } catch (err) {
        setAccountDetails((prev) => ({
          ...prev,
          [identifier]: {
            expanded: true,
            loading: false,
            error: err instanceof Error ? err.message : String(err),
            rows: [],
          },
        }));
      }
    }
  }

  const summaryConcepts = useMemo(() => {
    const map = new Map<string, number>();
    summary?.byAccount.forEach((row) => {
      const key = row.concept ?? "Sin concepto";
      map.set(key, (map.get(key) ?? 0) + row.total);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [summary]);

  return (
    <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Contrapartes</h2>
          <button
            type="button"
            onClick={() => selectCounterpart(null)}
            className="rounded-full bg-[var(--brand-primary)] px-3 py-1 text-xs font-semibold text-white shadow"
          >
            Nueva
          </button>
        </header>
        <ul className="space-y-1 text-sm text-slate-600">
          {counterparts.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => selectCounterpart(item.id)}
                className={`w-full rounded-lg px-3 py-2 text-left transition ${
                  selectedId === item.id
                    ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
                    : "hover:bg-slate-100"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="block font-medium">{item.name}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase text-slate-500">
                    {CATEGORY_LABELS[item.category] ?? item.category}
                  </span>
                </span>
                {item.rut && (
                  <span className="text-xs text-slate-500">RUT {formatRut(item.rut)}</span>
                )}
              </button>
            </li>
          ))}
          {!counterparts.length && <li className="text-xs text-slate-500">No hay registros aún.</li>}
        </ul>
      </aside>

      <div className="space-y-6">
        <section className="rounded-2xl border border-[var(--brand-primary)]/15 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-[var(--brand-primary)]">
            {selectedId ? "Editar contraparte" : "Nueva contraparte"}
          </h1>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-slate-600">
              RUT
              <input
                type="text"
                value={form.rut}
                onChange={(event) => setForm((prev) => ({ ...prev, rut: event.target.value }))}
                className="rounded border px-3 py-2"
                placeholder="12.345.678-9"
              />
              {form.rut && (
                <span className="text-xs text-slate-400">{formatRut(form.rut)}</span>
              )}
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-600">
              Nombre
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="rounded border px-3 py-2"
                placeholder="Allos Chile Spa"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-600">
              Tipo de persona
              <select
                value={form.personType}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, personType: event.target.value as CounterpartPersonType }))
                }
                className="rounded border px-3 py-2"
              >
                <option value="PERSON">Persona natural</option>
                <option value="COMPANY">Empresa</option>
                <option value="OTHER">Otra</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-600">
              Clasificación
              <select
                value={form.category}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, category: event.target.value as CounterpartCategory }))
                }
                className="rounded border px-3 py-2"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {form.category === "EMPLOYEE" && (
                <span className="text-xs text-slate-400">
                  Se vinculará como empleado utilizando el correo electrónico.
                </span>
              )}
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-600">
              Correo electrónico
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                className="rounded border px-3 py-2"
                placeholder="contacto@empresa.cl"
              />
            </label>
            <label className="md:col-span-2 flex flex-col gap-1 text-sm text-slate-600">
              Notas
              <textarea
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                className="min-h-[80px] rounded border px-3 py-2"
                placeholder="Información adicional, persona de contacto, etc."
              />
            </label>
          </div>
          {detail?.counterpart.employeeId && (
            <p className="mt-2 text-xs text-slate-500">
              Empleado vinculado (ID #{detail.counterpart.employeeId}).
              {" "}
              <Link to="/employees" className="font-semibold text-[var(--brand-primary)]">
                Ver empleados
              </Link>
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            {error && <span className="text-sm text-rose-600">{error}</span>}
            <button
              type="button"
              onClick={handleSaveCounterpart}
              disabled={formStatus === "saving"}
              className="rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-70"
            >
              {formStatus === "saving" ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </section>

        {selectedId && detail && (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-700">Cuentas asociadas</h2>
                <p className="text-xs text-slate-500">Identificadores detectados en los movimientos y asignados a esta contraparte.</p>
              </div>
            </header>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Cuenta</th>
                    <th className="px-3 py-2 text-left font-semibold">Banco</th>
                    <th className="px-3 py-2 text-left font-semibold">Titular</th>
                    <th className="px-3 py-2 text-left font-semibold">Concepto</th>
                    <th className="px-3 py-2 text-left font-semibold">Movimientos</th>
                  </tr>
                </thead>
                <tbody>
                  {accountGroups.map((group) => {
                    const summaryInfo = summaryByGroup.get(group.key);
                    const state = accountDetails[group.key];
                    return (
                      <Fragment key={group.key}>
                        <tr className="odd:bg-slate-50/60">
                          <td className="px-3 py-2 text-slate-600">
                            <div className="font-mono text-xs text-slate-600">{group.label}</div>
                            {group.accounts.length > 1 && (
                              <div className="text-[10px] text-slate-400">{group.accounts.length} identificadores vinculados</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{group.bankName ?? "-"}</td>
                          <td className="px-3 py-2 text-slate-600">{group.holder ?? "-"}</td>
                          <td className="px-3 py-2">
                            <input
                              key={`${group.key}-${group.concept}`}
                              type="text"
                              defaultValue={group.concept}
                              onBlur={(event) => handleGroupConceptChange(group, event.target.value)}
                              className="w-full rounded border px-2 py-1 text-xs"
                              placeholder="Concepto (ej. Compra de vacunas)"
                            />
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            <div className="flex flex-col gap-2 text-xs">
                              <button
                                type="button"
                                onClick={() => toggleAccountDetails(group)}
                                className="self-start rounded-full border border-[var(--brand-secondary)] px-3 py-1 font-semibold text-[var(--brand-secondary)] hover:bg-[var(--brand-secondary)]/10"
                              >
                                {state?.expanded ? "Ocultar movimientos" : "Ver movimientos"}
                              </button>
                              <div className="text-[11px] text-slate-500">
                                {state?.loading
                                  ? "Cargando movimientos..."
                                  : summaryInfo
                                  ? `${summaryInfo.count} mov. · ${fmtCLP(summaryInfo.total)}`
                                  : "Sin movimientos en el rango"}
                              </div>
                              {state?.error && (
                                <div className="text-[11px] text-rose-600">{state.error}</div>
                              )}
                            </div>
                          </td>
                        </tr>
                        {state?.expanded && (
                          <tr className="bg-slate-50/70">
                            <td colSpan={5} className="px-3 pb-4 pt-2">
                              {state.loading ? (
                                <p className="text-xs text-slate-500">Cargando movimientos...</p>
                              ) : state.error ? (
                                <p className="text-xs text-rose-600">{state.error}</p>
                              ) : state.rows.length ? (
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-xs">
                                    <thead className="bg-white text-slate-500">
                                      <tr>
                                        <th className="px-2 py-2 text-left font-semibold">Fecha</th>
                                        <th className="px-2 py-2 text-left font-semibold">Descripción</th>
                                        <th className="px-2 py-2 text-left font-semibold">Origen</th>
                                        <th className="px-2 py-2 text-left font-semibold">Destino</th>
                                        <th className="px-2 py-2 text-right font-semibold">Monto</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {state.rows.map((movement) => (
                                        <tr key={movement.id} className="border-t border-slate-200">
                                          <td className="px-2 py-2 text-slate-600">
                                            {dayjs(movement.timestamp).format("DD MMM YYYY HH:mm")}
                                          </td>
                                          <td className="px-2 py-2 text-slate-600">
                                            {movement.description ?? "(sin descripción)"}
                                          </td>
                                          <td className="px-2 py-2 text-slate-600">{movement.origin ?? "-"}</td>
                                          <td className="px-2 py-2 text-slate-600">{movement.destination ?? "-"}</td>
                                          <td className="px-2 py-2 text-right font-medium text-slate-700">
                                            {movement.amount != null ? fmtCLP(movement.amount) : "-"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500">No se encontraron movimientos para esta cuenta en el rango seleccionado.</p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {!accountGroups.length && (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-xs text-slate-500">
                        Sin cuentas asociadas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-700">Agregar cuenta</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-slate-600">
                  Identificador / Cuenta
                  <input
                    type="text"
                    value={accountForm.accountIdentifier}
                    onChange={(event) => {
                      setAccountForm((prev) => ({ ...prev, accountIdentifier: event.target.value }));
                      setSuggestionQuery(event.target.value);
                    }}
                    className="rounded border px-3 py-2"
                    placeholder="Ej. 124282432930"
                  />
                  {suggestionsLoading ? (
                    <span className="text-[10px] text-slate-400">Buscando sugerencias...</span>
                  ) : accountSuggestions.length ? (
                    <div className="overflow-hidden rounded border border-slate-200 bg-white">
                      {accountSuggestions.map((suggestion) => (
                        <div
                          key={suggestion.accountIdentifier}
                          className="flex flex-col gap-1 border-b border-slate-100 px-3 py-2 text-[11px] last:border-b-0"
                        >
                          <span className="font-semibold text-slate-600">{suggestion.accountIdentifier}</span>
                          <span className="text-slate-500">{suggestion.holder ?? "(sin titular)"}</span>
                          {suggestion.bankAccountNumber && (
                            <span className="text-[10px] text-slate-400">
                              Cuenta {suggestion.bankAccountNumber}
                            </span>
                          )}
                          {suggestion.rut && (
                            <span className="text-[10px] text-slate-400">RUT {formatRut(suggestion.rut)}</span>
                          )}
                          <span className="text-[10px] text-slate-400">
                            {suggestion.movements} mov. · {fmtCLP(suggestion.totalAmount)}
                          </span>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleSuggestionClick(suggestion)}
                              className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
                            >
                              Usar
                            </button>
                            {selectedId && suggestion.rut && (
                              <button
                                type="button"
                                onClick={() => handleAttachRut(suggestion.rut)}
                                disabled={attachLoading}
                                className="rounded-full border border-[var(--brand-secondary)] px-2 py-1 text-[10px] font-semibold text-[var(--brand-secondary)] hover:bg-[var(--brand-secondary)]/10 disabled:opacity-60"
                              >
                                {attachLoading ? "Vinculando..." : "Vincular por RUT"}
                              </button>
                            )}
                            {!selectedId && (
                              <button
                                type="button"
                                onClick={() => handleSuggestionCreate(suggestion)}
                                className="rounded-full border border-[var(--brand-primary)] px-2 py-1 text-[10px] font-semibold text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/10"
                              >
                                Crear contraparte
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-600">
                  Banco
                  <input
                    type="text"
                    value={accountForm.bankName}
                    onChange={(event) => setAccountForm((prev) => ({ ...prev, bankName: event.target.value }))}
                    className="rounded border px-3 py-2"
                    placeholder="Banco"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-600">
                  Número de cuenta
                  <input
                    type="text"
                    value={accountForm.bankAccountNumber}
                    onChange={(event) =>
                      setAccountForm((prev) => ({ ...prev, bankAccountNumber: event.target.value }))
                    }
                    className="rounded border px-3 py-2"
                    placeholder="Ej. 00123456789"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-600">
                  Titular
                  <input
                    type="text"
                    value={accountForm.holder}
                    onChange={(event) => setAccountForm((prev) => ({ ...prev, holder: event.target.value }))}
                    className="rounded border px-3 py-2"
                    placeholder="Titular de la cuenta"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-600">
                  Tipo / Concepto
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={accountForm.accountType}
                      onChange={(event) => setAccountForm((prev) => ({ ...prev, accountType: event.target.value }))}
                      className="w-1/2 rounded border px-3 py-2"
                      placeholder="Cuenta corriente"
                    />
                    <input
                      type="text"
                      value={accountForm.concept}
                      onChange={(event) => setAccountForm((prev) => ({ ...prev, concept: event.target.value }))}
                      className="w-1/2 rounded border px-3 py-2"
                      placeholder="Concepto"
                    />
                  </div>
                </label>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleAddAccount}
                  disabled={accountStatus === "saving"}
                  className="rounded-full bg-[var(--brand-secondary)] px-4 py-2 text-xs font-semibold text-white shadow disabled:opacity-70"
                >
                  {accountStatus === "saving" ? "Guardando..." : "Agregar"}
                </button>
              </div>
            </div>
          </section>
        )}

        {selectedId && (
          <section className="space-y-4 rounded-2xl border border-[var(--brand-primary)]/15 bg-white p-6 shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-[var(--brand-primary)]">Resumen mensual</h2>
                <p className="text-xs text-slate-500">
                  Transferencias de egreso asociadas a esta contraparte.
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                <label className="flex items-center gap-1">
                  Desde
                  <input
                    type="date"
                    value={summaryRange.from}
                    onChange={(event) => setSummaryRange((prev) => ({ ...prev, from: event.target.value }))}
                    className="rounded border px-2 py-1"
                  />
                </label>
                <label className="flex items-center gap-1">
                  Hasta
                  <input
                    type="date"
                    value={summaryRange.to}
                    onChange={(event) => setSummaryRange((prev) => ({ ...prev, to: event.target.value }))}
                    className="rounded border px-2 py-1"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => selectCounterpart(selectedId)}
                  className="rounded-full bg-[var(--brand-primary)] px-3 py-1 text-white"
                >
                  Actualizar
                </button>
              </div>
            </header>
            {summaryLoading ? (
              <p className="text-xs text-slate-500">Calculando resumen...</p>
            ) : summary ? (
              <div className="space-y-6">
                <MonthlySummaryChart data={summary.monthly} />
                <ConceptList concepts={summaryConcepts} />
              </div>
            ) : (
              <p className="text-xs text-slate-500">No hay datos disponibles.</p>
            )}
          </section>
        )}
      </div>
    </section>
  );
}

function MonthlySummaryChart({
  data,
}: {
  data: Array<{ month: string; concept: string; total: number }>;
}) {
  if (!data.length) {
    return <p className="text-xs text-slate-500">Sin movimientos en el rango seleccionado.</p>;
  }
  const grouped = data.reduce<Record<string, number>>((acc, row) => {
    const key = row.month;
    acc[key] = (acc[key] ?? 0) + row.total;
    return acc;
  }, {});
  const max = Math.max(...Object.values(grouped));
  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-4 pb-2">
        {Object.entries(grouped)
          .sort(([a], [b]) => (a > b ? 1 : -1))
          .map(([month, total]) => {
            const height = max ? Math.max((total / max) * 140, 4) : 4;
            return (
              <div key={month} className="flex min-w-[72px] flex-col items-center gap-2">
                <div className="flex h-40 w-full items-end">
                  <div className="w-full rounded-t bg-[var(--brand-primary)]/70" style={{ height: `${height}px` }} />
                </div>
                <span className="text-xs font-medium text-slate-600">{dayjs(month).format("MMM YY")}</span>
                <span className="text-[11px] font-semibold text-[var(--brand-primary)]">{fmtCLP(total)}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function ConceptList({ concepts }: { concepts: Array<[string, number]> }) {
  if (!concepts.length) {
    return <p className="text-xs text-slate-500">No hay conceptos asignados.</p>;
  }
  const max = Math.max(...concepts.map(([, value]) => value));
  return (
    <div className="space-y-3">
      {concepts.map(([concept, value]) => {
        const width = max ? Math.max((value / max) * 100, 4) : 4;
        return (
          <div key={concept} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium text-slate-700">{concept}</span>
              <span>{fmtCLP(value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-[var(--brand-primary)]/60" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
