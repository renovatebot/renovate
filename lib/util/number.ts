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
