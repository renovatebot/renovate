import { DateTime } from 'luxon';
import { decodeEntry, encodeEntry, isEnvelope } from './codec.ts';

const cachedAt = DateTime.fromISO('2024-01-02T03:04:05.678Z', {
  zone: 'utc',
});

describe('util/cache/package/codec', () => {
  it('round-trips an envelope entry', async () => {
    const value = { foo: 'bar', nested: [1, true, null] };

    const encoded = await encodeEntry(value, cachedAt);
    const decoded = await decodeEntry(encoded);

    expect(decoded.value).toEqual(value);
    expect(decoded.cachedAt.toMillis()).toBe(
      Math.floor(cachedAt.toSeconds()) * 1000,
    );
  });

  it('writes the expected header bytes', async () => {
    const encoded = await encodeEntry('value', cachedAt);

    expect(encoded.subarray(0, 4)).toEqual(
      Buffer.from([0x11, 0x91, 0x01, 0x00]),
    );
    expect(encoded.readUInt32BE(4)).toBe(Math.floor(cachedAt.toSeconds()));
  });

  it.each`
    data                                                 | expected
    ${Buffer.from([0x11, 0x91, 0x01, 0x00, 0, 0, 0, 0])} | ${true}
    ${Buffer.from([0x11])}                               | ${false}
    ${Buffer.from([0x11, 0x90, 0x01, 0x00, 0, 0, 0, 0])} | ${false}
    ${Buffer.from('{"value":"legacy"}')}                 | ${false}
  `('returns $expected for isEnvelope($data)', ({ data, expected }) => {
    expect(isEnvelope(data)).toBe(expected);
  });

  it('throws for truncated entries', async () => {
    await expect(decodeEntry(Buffer.from([0x11, 0x91]))).rejects.toThrow(
      'Truncated package cache entry',
    );
  });

  it('throws for wrong magic bytes', async () => {
    await expect(decodeEntry(Buffer.alloc(8))).rejects.toThrow(
      'Unsupported package cache format',
    );
  });

  it('throws for wrong version bytes', async () => {
    const encoded = await encodeEntry('value', cachedAt);
    encoded[2] = 0x02;

    await expect(decodeEntry(encoded)).rejects.toThrow(
      'Unsupported package cache format',
    );
  });

  it('throws for invalid brotli data', async () => {
    const encoded = Buffer.from([0x11, 0x91, 0x01, 0x00, 0, 0, 0, 0, 1]);

    await expect(decodeEntry(encoded)).rejects.toThrow(
      'unexpected end of file',
    );
  });

  it.each`
    timestamp                            | message
    ${DateTime.invalid('invalid')}       | ${'Invalid package cache timestamp'}
    ${DateTime.fromSeconds(-1)}          | ${'Package cache timestamp is out of range'}
    ${DateTime.fromSeconds(0x100000000)} | ${'Package cache timestamp is out of range'}
  `('throws for $timestamp', async ({ timestamp, message }) => {
    await expect(encodeEntry('value', timestamp)).rejects.toThrow(message);
  });
});
