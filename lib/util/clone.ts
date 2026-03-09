import { klona } from 'klona/json';
import { logger } from '../logger/index.ts';
import { quickStringify } from './stringify.ts';

/**
 * Creates a deep clone of an object.
 * @param input The object to clone.
 */
export function clone<T = unknown>(input: T): T {
  try {
    return klona(input);
  } catch (err) {
    logger.warn({ err }, 'error cloning object');
    const str = quickStringify(input);
    // v8 ignore else -- not easily testable
    if (str) {
      return JSON.parse(str) as T;
    }

    // istanbul ignore next: not easily testable
    throw err;
  }
}
