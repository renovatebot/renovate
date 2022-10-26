import { quickStringify } from './stringify';

export function clone<T>(input: T | null = null): T {
  const sortedinput = quickStringify(input);
  return sortedinput ? JSON.parse(sortedinput) : {};
}
