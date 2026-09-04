import type { MarketLocale } from "./types";

/** Whole-unit currency formatting for pack copy: 1000 → "£1,000" under EW_LOCALE. */
export function formatMoney(locale: MarketLocale, amount: number): string {
  return new Intl.NumberFormat(locale.bcp47, {
    style: "currency",
    currency: locale.currencyCode,
    maximumFractionDigits: 0,
  }).format(amount);
}
