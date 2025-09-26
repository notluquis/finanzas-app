export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function addCurrency(a: number, b: number): number {
  return roundCurrency(a + b);
}
