import { isArray, isNullOrUndefined } from '@sindresorhus/is';

export function coerceArray<T>(input: T[] | null | undefined): T[] {
  if (isArray(input)) {
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
  return !isNullOrUndefined(value);
}

/**
 * Converts a single value or an array of values to an array of values.
 * @param value a single value or an array of values
 * @returns array of values
 */
export function toArray<T>(value: T | T[]): T[] {
  return isArray(value) ? value : [value];
}

export function deduplicateArray<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}
