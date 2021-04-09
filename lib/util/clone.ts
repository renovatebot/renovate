import safeStringify from 'fast-safe-stringify';

export function clone<T>(input: T = null): T {
  return JSON.parse(safeStringify(input));
}
