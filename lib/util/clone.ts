import { quickStringify } from './stringify';

export function clone<T>(input: T | null = null): T {
  const clonedInput = quickStringify(input);
  return clonedInput ? JSON.parse(clonedInput) : {};
}
