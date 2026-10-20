/**
 * Money is held as an integer count of the currency's minor unit — piastres
 * for EGP — so no amount is ever a binary fraction. Every function here takes
 * and returns minor units; converting to and from "12.50" happens only at the
 * edges (parsing input, formatting output).
 *
 * Rounding is half up, away from zero, applied once where an amount is
 * created (a percentage, a share of a split). Sums of stored integers are
 * exact and never rounded again.
 */

/**
 * Currencies a store may keep its books in (ISO 4217), with their minor-unit
 * digits. The digits are derived from the code, never stored beside it, so the
 * two can't disagree. Add one here only once its rounding has been checked.
 */
export const CURRENCIES: Record<string, { minorUnit: number }> = {
  EGP: { minorUnit: 2 },
};

export const DEFAULT_CURRENCY = 'EGP';

/** Minor-unit digits of the default currency. */
export const DEFAULT_MINOR_UNIT = CURRENCIES[DEFAULT_CURRENCY].minorUnit;

/** Minor-unit digits for a supported currency code. */
export function minorUnitOf(code: string): number {
  if (!Object.prototype.hasOwnProperty.call(CURRENCIES, code)) {
    throw new MoneyError(`Unsupported currency "${code}"`);
  }
  return CURRENCIES[code].minorUnit;
}

/** Thrown for input that is not a valid amount. Callers turn it into a 400. */
export class MoneyError extends Error {}

/** Arabic-Indic and Persian digits as ASCII, so "١٢٫٥٠" parses like "12.50". */
export const westernDigits = (text: string) =>
  text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/**
 * A decimal amount as minor units: `"12.5"` → 1250. Refuses negatives, more
 * decimals than the currency has, exponents and anything non-numeric — a
 * float such as `0.1 + 0.2` arrives as "0.30000000000000004" and is refused
 * rather than silently rounded.
 */
export function parseMoney(input: string | number, minorUnit = DEFAULT_MINOR_UNIT): number {
  return parseDecimal(input, minorUnit, 'amount');
}

/**
 * A non-negative decimal scaled by 10^digits, exactly. Shared by amounts and
 * percentages, which need more digits than money (12.345%).
 */
export function parseDecimal(input: string | number, digits: number, what = 'number'): number {
  const text = westernDigits(String(input)).trim().replace('٫', '.');
  const match = /^(\d+)(?:\.(\d*))?$/.exec(text);
  if (!match) throw new MoneyError(`Invalid ${what}: "${input}"`);

  const [, whole, fraction = ''] = match;
  if (fraction.length > digits) {
    throw new MoneyError(`Invalid ${what}: "${input}" has more than ${digits} decimal places`);
  }

  const scaled = BigInt(whole + fraction.padEnd(digits, '0'));
  if (scaled > BigInt(Number.MAX_SAFE_INTEGER)) throw new MoneyError(`Invalid ${what}: "${input}" is too large`);
  return Number(scaled);
}

/** Whether `value` is a usable minor-unit amount: a safe, non-negative integer. */
export function isMinor(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

/**
 * round_half_up(a × b ÷ c) without a float in sight. BigInt keeps the product
 * exact even when it passes 2^53.
 */
export function mulDiv(a: number, b: number, c: number): number {
  if (![a, b, c].every(Number.isSafeInteger)) throw new MoneyError('mulDiv takes integers');
  if (c === 0) throw new MoneyError('Division by zero');

  const product = BigInt(a) * BigInt(b);
  const divisor = BigInt(c);
  const negative = product < 0n !== divisor < 0n;
  const n = product < 0n ? -product : product;
  const d = divisor < 0n ? -divisor : divisor;
  // Half up, away from zero: add half the divisor before truncating.
  const rounded = (2n * n + d) / (2n * d);
  return Number(negative ? -rounded : rounded);
}

/** Digits a percentage may carry: 12.5% and 33.333% are fine, 33.33333% is not. */
const PERCENT_DIGITS = 4;

/** `percent`% of an amount, rounded half up to one minor unit. */
export function percentOf(amountMinor: number, percent: number | string): number {
  const scaled = parseDecimal(percent, PERCENT_DIGITS, 'percentage');
  return mulDiv(amountMinor, scaled, 100 * 10 ** PERCENT_DIGITS);
}

/**
 * Splits `totalMinor` across parts in proportion to `weights` so the parts add
 * up to exactly the total (largest-remainder method). Each part first gets the
 * floor of its exact share; the units left over go one each to the largest
 * remainders, earliest part first on a tie, so the same input always splits
 * the same way.
 */
export function allocate(totalMinor: number, weights: number[]): number[] {
  if (!isMinor(totalMinor)) throw new MoneyError('allocate takes a non-negative integer total');
  if (!weights.every(isMinor)) throw new MoneyError('allocate takes non-negative integer weights');
  if (totalMinor === 0) return weights.map(() => 0);

  const sum = weights.reduce((a, b) => a + BigInt(b), 0n);
  if (sum === 0n) throw new MoneyError('Cannot allocate an amount across parts that are all zero');

  const total = BigInt(totalMinor);
  const shares = weights.map((w, index) => {
    const exact = total * BigInt(w);
    return { index, floor: exact / sum, remainder: exact % sum };
  });

  let left = total - shares.reduce((a, s) => a + s.floor, 0n);
  const byRemainder = [...shares].sort((x, y) =>
    x.remainder === y.remainder ? x.index - y.index : x.remainder > y.remainder ? -1 : 1,
  );
  for (const share of byRemainder) {
    if (left === 0n) break;
    share.floor += 1n;
    left -= 1n;
  }

  return shares.map((s) => Number(s.floor));
}

/** Minor units as a plain decimal string for exports and logs: 31500 → "315.00". */
export function formatMinor(minor: number, minorUnit = DEFAULT_MINOR_UNIT): string {
  if (!Number.isSafeInteger(minor)) throw new MoneyError('formatMinor takes an integer');
  const sign = minor < 0 ? '-' : '';
  const digits = String(Math.abs(minor)).padStart(minorUnit + 1, '0');
  if (minorUnit === 0) return sign + digits;
  return `${sign}${digits.slice(0, -minorUnit)}.${digits.slice(-minorUnit)}`;
}
