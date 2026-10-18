/** Round to whole paise (2 decimals). All stored money goes through this. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sumMoney(values: readonly number[]): number {
  return roundMoney(values.reduce((total, v) => total + v, 0));
}

/** Share of `part` in `whole` as a percentage (0 when `whole` is 0). */
export function percentOf(part: number, whole: number): number {
  return whole === 0 ? 0 : (part / whole) * 100;
}

/**
 * Split a total between two parties. The second share is the remainder, so the
 * two parts always add back to the total exactly, with no paise lost.
 */
export function splitTotal(
  total: number,
  pctToFirst: number,
): [first: number, second: number] {
  const first = roundMoney((total * clamp(pctToFirst, 0, 100)) / 100);
  return [first, roundMoney(total - first)];
}

export function nominalTotal(monthly: number, years: number): number {
  return roundMoney(monthly * 12 * years);
}

/** Effective annual rate (%) to the equivalent monthly rate (fraction). */
export function monthlyRate(annualRatePct: number): number {
  return Math.pow(1 + annualRatePct / 100, 1 / 12) - 1;
}

/**
 * Present value of `monthly` paid at the end of every month for `years`,
 * discounted at an effective annual rate. With a 0% rate it is the plain total.
 */
export function presentValue(
  monthly: number,
  years: number,
  annualRatePct: number,
): number {
  const months = Math.round(years * 12);
  if (months <= 0 || monthly === 0) return 0;
  const r = monthlyRate(annualRatePct);
  if (r === 0) return roundMoney(monthly * months);
  return roundMoney((monthly * (1 - Math.pow(1 + r, -months))) / r);
}

export type YearPoint = {
  year: number;
  nominal: number;
  presentValue: number;
};

/** Cumulative paid and its present value at the end of each year (for charts). */
export function cumulativeSeries(
  monthly: number,
  years: number,
  annualRatePct: number,
): YearPoint[] {
  const points: YearPoint[] = [];
  for (let year = 0; year <= years; year++)
    points.push({
      year,
      nominal: nominalTotal(monthly, year),
      presentValue: presentValue(monthly, year, annualRatePct),
    });
  return points;
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const inrPrecise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹45,00,000 style (Indian digit grouping). */
export function formatInr(value: number, precise = false): string {
  const v = Object.is(value, -0) ? 0 : value;
  return (precise ? inrPrecise : inr).format(v);
}

/** Short labels for chart axes: ₹12,000, ₹4.5 L, ₹1.2 Cr. */
export function formatInrCompact(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, "");
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)} Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)} L`;
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}