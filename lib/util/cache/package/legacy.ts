import { DateTime } from 'luxon';
import { decompressFromBase64, decompressFromBuffer } from '../../compress.ts';

// Decode-only support for pre-binary cache formats. Delete this file (and its single call site in impl/base.ts) once entries written before <release> have expired.

export interface LegacyEntry {
  value: unknown;
  expiry: DateTime | undefined;
}

interface LegacyJsonEntry {
  value: unknown;
  expiry: unknown;
}

export async function decodeLegacyEntry(data: Buffer): Promise<LegacyEntry> {
  if (data[0] === 0x7b) {
    return await decodeLegacyJsonEntry(data);
  }

  return await decodeLegacySqliteEntry(data);
}

async function decodeLegacyJsonEntry(data: Buffer): Promise<LegacyEntry> {
  const cached = JSON.parse(data.toString('utf8')) as LegacyJsonEntry;

  if (typeof cached.value !== 'string' || typeof cached.expiry !== 'string') {
    throw new Error('Invalid legacy JSON package cache entry');
  }

  const json = await decompressFromBase64(cached.value);

  return {
    value: JSON.parse(json),
    expiry: DateTime.fromISO(cached.expiry),
  };
}

async function decodeLegacySqliteEntry(data: Buffer): Promise<LegacyEntry> {
  const json = await decompressFromBuffer(data);

  return {
    value: JSON.parse(json),
    expiry: undefined,
  };
}
