import { klona } from 'klona/json';

/**
 * Creates a deep clone of an object.
 * @deprecated Use {@link structuredClone} instead.
 * @param input The object to clone.
 */
export function clone<T = unknown>(input: T): T {
  try {
    return klona(input);
  } catch (error) {
    if (error.name === 'RangeError') {
      throw new Error('Circular reference detected');
    }

    // istanbul ignore next: not easily testable
    throw error;
  }
}
