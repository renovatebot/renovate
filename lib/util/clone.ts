import safeStringify from 'fast-safe-stringify';

export function clone<T>(input: T): T {
  return JSON.parse(safeStringify(input));
}
