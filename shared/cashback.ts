export const CASHBACK_KEYWORDS = [
  "cashback",
  "meli+",
  "melidolar",
  "meli dolar",
  "melidólar",
  "meli-dolar",
];

export type CashbackCandidate = {
  direction: string;
  description?: string | null;
  origin?: string | null;
  destination?: string | null;
};

export function isCashbackCandidate(candidate: CashbackCandidate): boolean {
  if (!candidate || candidate.direction.toUpperCase() !== "IN") {
    return false;
  }

  const haystack = [candidate.description, candidate.origin, candidate.destination]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ")
    .toLowerCase();

  if (!haystack) return false;

  return CASHBACK_KEYWORDS.some((keyword) => haystack.includes(keyword));
}
