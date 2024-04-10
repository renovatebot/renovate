import is from '@sindresorhus/is';

export function coerceArray<T>(input: T[] | null | undefined): T[] {
  if (is.array(input)) {
    return input;
  }
  return [];
}

// Useful for filtering an array so that it includes values that are not null or
// undefined. This predicate acts as a type guard so that the resulting type for
// `values.filter(isNotNullOrUndefined)` is `T[]`.
export function isNotNullOrUndefined<T>(
  value: T | undefined | null,
): value is T {
  return !is.nullOrUndefined(value);
}

/**
 * Converts a single value or an array of values to an array of values.
 * @param value a single value or an array of values
 * @returns array of values
 */
export function toArray<T>(value: T | T[]): T[] {
  return is.array(value) ? value : [value];
}

export function deduplicateArray<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

export async function asyncFilter<T>(
  arr: T[],
  predicate: (value: T) => Promise<boolean>,
): Promise<T[]> {
  const results = await Promise.all(arr.map(predicate));
  return arr.filter((_v, index) => results[index]);
}
