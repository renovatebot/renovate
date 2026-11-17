import { DateTime } from 'luxon';
import { compressToBuffer, decompressFromBuffer } from '../../compress.ts';

const headerLength = 8;
const prefixWord = 0x11910100;

/**
 * Format detection must not collide with anything older Renovate versions
 * stored. Legacy entries are either JSON wrappers, which always start with `{`
 * (`0x7b`), or raw brotli blobs from the SQLite backend.
 *
 * Brotli streams start with the WBITS field (RFC 7932, section 9.1). Standard
 * brotli reserves `0010001` as an invalid bit pattern. The only byte values
 * whose low seven bits match that pattern are `0x11` and `0x91`, so no valid
 * legacy brotli stream can start with either byte.
 *
 * This does not account for `BROTLI_PARAM_LARGE_WINDOW`, which Renovate has
 * never enabled. Both bytes also fall outside the base64 alphabet and printable
 * JSON, giving the prefix extra margin against other legacy-looking payloads.
 */
const magic0 = 0x11;
const magic1 = 0x91;

const formatVersion = 0x01;
const reserved = 0x00;

export interface EnvelopeEntry {
  value: unknown;
  cachedAt: DateTime;
}

export function isEnvelope(data: Buffer): boolean {
  return data[0] === magic0 && data[1] === magic1;
}

export async function encodeEntry(
  value: unknown,
  cachedAt: DateTime,
): Promise<Buffer> {
  const cachedAtSeconds = cachedAtToSeconds(cachedAt);
  const compressed = await compressToBuffer(JSON.stringify(value));
  const data = Buffer.alloc(headerLength + compressed.length);

  data[0] = magic0;
  data[1] = magic1;
  data[2] = formatVersion;
  data[3] = reserved;
  data.writeUInt32BE(cachedAtSeconds, 4);
  compressed.copy(data, headerLength);

  return data;
}

export async function decodeEntry(data: Buffer): Promise<EnvelopeEntry> {
  if (data.length < headerLength) {
    throw new Error('Truncated package cache entry');
  }

  if (data.readUInt32BE(0) !== prefixWord) {
    throw new Error('Unsupported package cache format');
  }

  const cachedAtSeconds = data.readUInt32BE(4);
  const json = await decompressFromBuffer(data.subarray(headerLength));

  return {
    value: JSON.parse(json),
    cachedAt: DateTime.fromSeconds(cachedAtSeconds),
  };
}

function cachedAtToSeconds(cachedAt: DateTime): number {
  if (!cachedAt.isValid) {
    throw new Error('Invalid package cache timestamp');
  }

  const cachedAtSeconds = Math.floor(cachedAt.toSeconds());
  // UInt32 seconds are enough for cache timestamps until 2106.
  if (cachedAtSeconds < 0 || cachedAtSeconds > 0xffffffff) {
    throw new Error('Package cache timestamp is out of range');
  }

  return cachedAtSeconds;
}
