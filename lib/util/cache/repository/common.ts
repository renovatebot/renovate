import is from '@sindresorhus/is';
import type { RepoCacheData, RepoCacheRecord } from './types';

// Increment this whenever there could be incompatibilities between old and new cache structure
export const CACHE_REVISION = 11;

export function isValidCacheRecord(
  input: unknown,
  repo?: string
): input is RepoCacheRecord {
  return (
    is.plainObject(input) &&
    is.string(input.repository) &&
    is.safeInteger(input.revision) &&
    (!repo || repo === input.repository) &&
    input.revision === CACHE_REVISION
  );
}

export function canBeMigratedToV11(
  input: unknown,
  repo?: string
): input is RepoCacheData & { repository?: string; revision?: number } {
  return (
    is.plainObject(input) &&
    is.string(input.repository) &&
    is.safeInteger(input.revision) &&
    (!repo || repo === input.repository) &&
    input.revision === 10
  );
}
