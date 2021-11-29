import safeStringify from 'fast-safe-stringify';

export function clone<T>(input: T | null = null): T {
  return JSON.parse(safeStringify(input));
}
