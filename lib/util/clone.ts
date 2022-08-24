import { configure } from 'safe-stable-stringify';

const stringify = configure({
  deterministic: false,
});

export function clone<T>(input: T | null = null): T {
  return JSON.parse(stringify(input));
}
