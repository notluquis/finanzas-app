export type CsvRow = Record<string, string>;

export type MovementRecord = {
  timestampRaw: string;
  timestamp: Date;
  description?: string;
  origin?: string;
  destination?: string;
  sourceId?: string;
  direction: "IN" | "OUT" | "NEUTRO";
  amount: number;
  raw: CsvRow;
};

export function buildMovements(rows: CsvRow[], accountName: string): MovementRecord[] {
  const movements: MovementRecord[] = [];

  for (const row of rows) {
    const movement = transformRow(row, accountName);
    if (movement) movements.push(movement);
  }

  return movements;
}

function transformRow(row: CsvRow, accountName: string): MovementRecord | null {
  const amountRaw = firstNumber([
    toNumber(row.REAL_AMOUNT),
    toNumber(row.TRANSACTION_AMOUNT),
    toNumber(row.NET_CREDIT),
    negateIf(toNumber(row.NET_DEBIT)),
  ]);

  if (amountRaw == null || Number.isNaN(amountRaw)) return null;

  const direction = inferDirection(row, amountRaw);
  const amount = Math.abs(amountRaw);

  const timestampString =
    row.TRANSACTION_DATE || row.MONEY_RELEASE_DATE || row.SETTLEMENT_DATE || row.DATE;
  if (!timestampString) return null;

  const timestamp = parseTimestamp(timestampString);
  if (!timestamp) return null;

  const counterparty =
    row.SOURCE_ID ||
    row.RELATED_ID ||
    row.SUB_UNIT ||
    row.BUSINESS_UNIT ||
    row.PAYMENT_METHOD_TYPE ||
    undefined;

  const sourceId = row.SOURCE_ID || row.RELATED_ID || undefined;

  const description =
    row.DESCRIPTION ||
    row.TRANSACTION_TYPE ||
    row.PAYMENT_METHOD_TYPE ||
    row.SUB_UNIT ||
    row.BUSINESS_UNIT ||
    undefined;

  const origin =
    direction === "OUT"
      ? accountName
      : counterparty || row.BUSINESS_UNIT || row.SUB_UNIT || "Externo";
  const destination =
    direction === "IN"
      ? accountName
      : counterparty || row.BUSINESS_UNIT || row.SUB_UNIT || "Externo";

  return {
    timestampRaw: timestampString,
    timestamp,
    description,
    origin,
    destination,
    sourceId,
    direction,
    amount,
    raw: row,
  };
}

function parseTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toNumber(value?: string): number | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const cleaned = trimmed
    .replace(/CLP/gi, "")
    .replace(/\$/g, "")
    .replace(/\s+/g, "")
    .replace(/[^0-9,.-]/g, "");

  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === ",") return undefined;

  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
  } else {
    normalized = cleaned.replace(/,/g, ".");
  }

  const num = Number(normalized);
  return Number.isFinite(num) ? num : undefined;
}

function negateIf(value?: number) {
  if (typeof value !== "number") return undefined;
  return value > 0 ? -value : value;
}

function firstNumber(values: Array<number | undefined>): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

const creditHints = [
  "credit",
  "payment",
  "charge",
  "collection",
  "release",
  "deposit",
  "incoming",
];
const debitHints = [
  "debit",
  "withdraw",
  "withdrawal",
  "payout",
  "transfer",
  "outgoing",
  "retention",
];

function inferDirection(row: CsvRow, amount?: number): MovementRecord["direction"] {
  const type = (row.TRANSACTION_TYPE || "").toLowerCase();
  const method = (row.PAYMENT_METHOD_TYPE || "").toLowerCase();

  if (typeof amount === "number" && amount !== 0) {
    return amount > 0 ? "IN" : "OUT";
  }

  if (creditHints.some((hint) => type.includes(hint) || method.includes(hint))) return "IN";
  if (debitHints.some((hint) => type.includes(hint) || method.includes(hint))) return "OUT";

  return "NEUTRO";
}
