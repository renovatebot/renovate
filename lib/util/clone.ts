import { quickStringify } from './stringify';

/**
 * Creates a deep clone of an object.
 * @deprecated Use {@link structuredClone} instead.
 * @param input The object to clone.
 */
export function clone<T>(input: T | null = null): T {
  const stringifiedInput = quickStringify(input);
  return stringifiedInput ? JSON.parse(stringifiedInput) : null;
}
