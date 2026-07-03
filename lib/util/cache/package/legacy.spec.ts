import { DateTime } from 'luxon';
import { compressToBase64, compressToBuffer } from '../../compress.ts';
import { isEnvelope } from './codec.ts';
import { decodeLegacyEntry } from './legacy.ts';

async function legacyJsonWrapper(
  value: unknown,
  expiry: DateTime,
): Promise<Buffer> {
  const payload = JSON.stringify({
    value: await compressToBase64(JSON.stringify(value)),
    expiry,
  });

  return Buffer.from(payload);
}

// TODO: Delete this spec with legacy.ts once pre-envelope entries have expired.
describe('util/cache/package/legacy', () => {
  it('decodes legacy JSON-wrapper entries', async () => {
    const expiry = DateTime.local().plus({ minutes: 5 });
    const value = { foo: 'bar' };

    const entry = await decodeLegacyEntry(
      await legacyJsonWrapper(value, expiry),
    );

    expect(entry.value).toEqual(value);
    expect(entry.expiry?.toISO()).toBe(expiry.toISO());
  });

  it('decodes legacy SQLite raw-brotli entries', async () => {
    const value = { foo: 'bar' };
    const data = await compressToBuffer(JSON.stringify(value), 3);

    const entry = await decodeLegacyEntry(data);

    expect(entry.value).toEqual(value);
    expect(entry.expiry).toBeUndefined();
  });

  it('throws for garbage entries', async () => {
    await expect(decodeLegacyEntry(Buffer.from('garbage'))).rejects.toThrow();
  });

  it('does not classify legacy brotli payloads as envelopes', async () => {
    const inputs = [
      '',
      'foobar',
      JSON.stringify({ foo: 'bar' }),
      'x'.repeat(1024),
      'αβγ'.repeat(128),
    ];

    for (const quality of [3, 8]) {
      for (const input of inputs) {
        const compressed = await compressToBuffer(input, quality);

        expect(isEnvelope(compressed)).toBeFalse();
      }
    }
  });
});
