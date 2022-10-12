import hasha from 'hasha';
import { safeStringify } from './stringify';

export function fingerprint(input: unknown): string {
  return hasha(safeStringify(input));
}
