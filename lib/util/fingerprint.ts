import hasha from 'hasha';
import { safeStringify } from './stringify';

export function fingerprint(input: unknown): string {
  const stringifiedInput = safeStringify(input);
  return stringifiedInput ? hasha(stringifiedInput) : '';
}
