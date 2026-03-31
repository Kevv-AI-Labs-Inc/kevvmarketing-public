import type { Locale } from "@/i18n/config";
import { localeTag } from "@/i18n/copy";

/**
 * Unified formatting utilities — locale-aware currency, date, and number formatting.
 *
 * Replaces the 6+ duplicate `formatPrice()` functions scattered across the codebase
 * and fixes inconsistent `toLocaleString()` calls that were missing locale parameters.
 */

// ─── Currency ──────────────────────────────────────────────

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(locale: Locale): Intl.NumberFormat {
  const tag = localeTag(locale);
  let fmt = currencyFormatters.get(tag);
  if (!fmt) {
    fmt = new Intl.NumberFormat(tag, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
    currencyFormatters.set(tag, fmt);
  }
  return fmt;
}

/** Format a number as USD with locale-appropriate grouping (e.g. $1,200,000). */
export function formatCurrency(value: number, locale: Locale): string {
  return getCurrencyFormatter(locale).format(value);
}

/**
 * Compact currency formatter: $1.2M / $450K / $135,000
 * Used in listings, share pages, and anywhere space is tight.
 */
export function formatCurrencyCompact(value: number, _locale: Locale): string {
  const num = Number(value);
  if (Number.isNaN(num)) return "$0";
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toLocaleString("en-US")}`;
}

// ─── Numbers ───────────────────────────────────────────────

/** Format a plain number with locale-appropriate grouping (e.g. 1,234). */
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(localeTag(locale)).format(value);
}

// ─── Dates ─────────────────────────────────────────────────

/** Format a date as "Mar 15, 2:30 PM" in the given locale. */
export function formatDateTime(value: string | Date | null | undefined, locale: Locale): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(localeTag(locale), {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** Format a date as "Mar 15, 2026" in the given locale. */
export function formatDateOnly(value: string | Date | null | undefined, locale: Locale): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(localeTag(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

// ─── Distance ──────────────────────────────────────────────

/** Format meters as "1.2 km" */
export function formatDistanceKm(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Format meters as "1.2 mi" */
export function formatDistanceMi(meters: number): string {
  return `${(meters / 1609.34).toFixed(1)} mi`;
}
