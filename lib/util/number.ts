import is from '@sindresorhus/is';

/**
 * Coerces a value to a number with optional default value.
 * @param val the value to coerce
 * @param def default value
 * @returns cocerced value
 */
export function coerceNumber(
  val: number | null | undefined,
  def?: number,
): number {
  return val ?? def ?? 0;
}

/**
 * Parses a value as a finite positive integer with optional default value.
 * If no default value is provided, the default value is 0.
 * @param val Value to parse as finite integer.
 * @param def Optional default value.
 * @returns The parsed value or the default value if the parsed value is not finite.
 */
export function parseInteger(
  val: string | undefined | null,
  def?: number,
): number {
  // Number.parseInt returns NaN if the value is not a finite integer.
  const parsed =
    is.string(val) && /^\d+$/.test(val) ? Number.parseInt(val) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : (def ?? 0);
}
