import { roundCurrency } from "../../../shared/currency";
import type { BalancesApiResponse } from "./types";

export function formatBalanceInput(value: number) {
  if (!Number.isFinite(value)) return "";
  const rounded = roundCurrency(value);
  return Number.isInteger(rounded) ? String(Math.trunc(rounded)) : rounded.toFixed(2);
}

export function parseBalanceInput(value: string) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed
    .replace(/CLP/gi, "")
    .replace(/\$/g, "")
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function deriveInitialBalance(report: BalancesApiResponse): number | null {
  if (report.previous) {
    return roundCurrency(report.previous.balance);
  }

  for (const day of report.days) {
    if (day.recordedBalance != null) {
      return roundCurrency(day.recordedBalance - day.netChange);
    }
    if (day.expectedBalance != null) {
      return roundCurrency(day.expectedBalance - day.netChange);
    }
  }

  return null;
}
