import is from '@sindresorhus/is';

export function isNotNullOrUndefined<T>(
  value: T | undefined | null
): value is T {
  return !is.nullOrUndefined(value);
}
