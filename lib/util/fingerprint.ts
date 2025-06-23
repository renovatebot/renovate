import { hash } from './hash';
import { safeStringify } from './stringify';

export function fingerprint(input: unknown): string {
  const stringifiedInput = safeStringify(input);
  return stringifiedInput ? hash(stringifiedInput) : '';
}
