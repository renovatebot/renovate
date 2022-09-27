import is from '@sindresorhus/is';

export function coerceArray(input: unknown): any[] {
  if (is.array(input)) {
    return input;
  }
  return [];
}
