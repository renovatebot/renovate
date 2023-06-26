import { klona } from 'klona/json';

/**
 * Creates a deep clone of an object.
 * @param input The object to clone.
 */
export function clone<T = unknown>(input: T): T {
  return klona(input);
}
