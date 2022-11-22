import { quickStringify } from './stringify';

export function clone<T>(input: T | null = null): T {
  const stringifiedInput = quickStringify(input);
  return stringifiedInput ? JSON.parse(stringifiedInput) : null;
}
