import hasha from 'hasha';
import { safeStringify } from './stringify';

export function fingerprint(input: unknown): string {
  const sortedInput = safeStringify(input);
  return sortedInput ? hasha(sortedInput) : '';
}
