import is from '@sindresorhus/is';

export function coerceArray<T>(input: T[] | null | undefined): T[] {
  if (is.array(input)) {
    return input;
  }
  return [];
}
