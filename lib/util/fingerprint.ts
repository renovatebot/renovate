import { hash } from './hash.ts';
import { safeStringify } from './stringify.ts';

export function fingerprint(input: unknown): string {
  const stringifiedInput = safeStringify(input);
  return stringifiedInput ? hash(stringifiedInput) : '';
}
