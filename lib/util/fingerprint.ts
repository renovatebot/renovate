import hasha from 'hasha';
import { safeStringify } from './stringify';

export function fingerprint(input: unknown): string {
  const modifiedInput = safeStringify(input);
  return modifiedInput ? hasha(modifiedInput) : '';
}
