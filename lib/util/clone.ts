import { klona } from 'klona/json';
import { quickStringify } from './stringify';

/**
 * Creates a deep clone of an object.
 * @deprecated Use {@link structuredClone} instead.
 * @param input The object to clone.
 */
export function clone<T = unknown>(input: T): T {
  try {
    return klona(input);
  } catch (err) {
    const str = quickStringify(input);
    if (str) {
      return JSON.parse(str);
    }

    // istanbul ignore next: not easily testable
    throw err;
  }
}
