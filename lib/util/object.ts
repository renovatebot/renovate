/**
 * This is a workaround helper to allow the usage of 'unknown' in
 * a type-guard function while checking that keys exist.
 *
 * @see https://github.com/microsoft/TypeScript/issues/21732
 * @see https://stackoverflow.com/a/58630274
 */
export function hasKey<K extends string, T>(
  k: K,
  o: T,
): o is T & Record<K, unknown> {
  return o && typeof o === 'object' && k in o;
}

/**
 * Coerce a value to a object with optional default value.
 * @param val value to coerce
 * @returns the coerced value.
 */
export function coerceObject<T>(val: T | null | undefined, def?: T): T {
  return val ?? def ?? ({} as T);
}
