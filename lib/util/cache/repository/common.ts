import is from '@sindresorhus/is';
import type { RepoCacheData, RepoCacheRecord } from './types';

// Increment this whenever there could be incompatibilities between old and new cache structure
export const CACHE_REVISION = 12;

export function isValidRev10(
  input: unknown,
  repo?: string
): input is RepoCacheData & { repository?: string; revision?: number } {
  return (
    is.plainObject(input) &&
    is.safeInteger(input.revision) &&
    input.revision === 10 &&
    is.string(input.repository) &&
    (!repo || repo === input.repository)
  );
}

export function isValidRev11(
  input: unknown,
  repo?: string
): input is { repository: string; revision: number; data: RepoCacheData } {
  return (
    is.plainObject(input) &&
    is.safeInteger(input.revision) &&
    input.revision === 11 &&
    is.string(input.repository) &&
    is.plainObject(input.data) &&
    (!repo || repo === input.repository)
  );
}

export function isValidRev12(
  input: unknown,
  repo?: string
): input is RepoCacheRecord {
  return (
    is.plainObject(input) &&
    is.safeInteger(input.revision) &&
    input.revision === CACHE_REVISION &&
    is.string(input.repository) &&
    (!repo || repo === input.repository) &&
    is.string(input.payload) &&
    is.string(input.hash)
  );
}
