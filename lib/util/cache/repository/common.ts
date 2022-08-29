import is from '@sindresorhus/is';
import type {
  RepoCacheRecordV10,
  RepoCacheRecordV11,
  RepoCacheRecordV12,
  RepoCacheRecordV13,
} from './types';

// Increment this whenever there could be incompatibilities between old and new cache structure
export const CACHE_REVISION = 13;

export function isValidRev10(
  input: unknown,
  repo?: string
): input is RepoCacheRecordV10 {
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
): input is RepoCacheRecordV11 {
  return (
    is.plainObject(input) &&
    is.safeInteger(input.revision) &&
    input.revision === 11 &&
    is.string(input.repository) &&
    is.plainObject(input.data) &&
    (!repo || repo === input.repository)
  );
}

function isValidRev12Shape(
  input: unknown,
  repo?: string
): input is RepoCacheRecordV12 {
  return (
    is.plainObject(input) &&
    is.safeInteger(input.revision) &&
    is.string(input.repository) &&
    is.string(input.payload) &&
    is.string(input.hash)
  );
}

export function isValidRev12(
  input: unknown,
  repo?: string
): input is RepoCacheRecordV12 {
  return (
    isValidRev12Shape(input, repo) &&
    input.revision === 12 &&
    (!repo || repo === input.repository)
  );
}

export function isValidRev13(input: unknown): input is RepoCacheRecordV13 {
  return (
    is.plainObject(input) &&
    is.string(input.fingerprint) &&
    isValidRev12Shape(input) &&
    input.revision === 13
  );
}
