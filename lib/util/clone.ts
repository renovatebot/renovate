import { quickStringify } from './stringify';

export function clone<T>(input: T | null = null): T {
  return JSON.parse(quickStringify(input));
}
