import is from '@sindresorhus/is';
import type { RepoCacheRecord } from './types';

// Increment this whenever there could be incompatibilities between old and new cache structure
export const CACHE_REVISION = 1;

export function isValidCacheRecord(input: unknown): input is RepoCacheRecord {
  return (
    is.plainObject(input) &&
    is.safeInteger(input.revision) &&
    input.revision === CACHE_REVISION &&
    is.string(input.repository) &&
    is.string(input.fingerprint) &&
    is.string(input.payload) &&
    is.string(input.hash)
  );
}
