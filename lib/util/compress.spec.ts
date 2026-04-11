import {
  compressToBase64,
  compressToBuffer,
  decompressFromBase64,
  decompressFromBuffer,
} from './compress.ts';

describe('util/compress', () => {
  it('compresses strings', async () => {
    const input = 'foobar';

    const compressed = await compressToBase64(input);
    expect(compressed).toBe('iwKAZm9vYmFyAw==');

    const decompressed = await decompressFromBase64(compressed);
    expect(decompressed).toBe(input);
  });

  it('compresses strings to buffers', async () => {
    const input = 'foobar';

    const compressed = await compressToBuffer(input);
    const decompressed = await decompressFromBuffer(compressed);

    expect(Buffer.isBuffer(compressed)).toBeTrue();
    expect(decompressed).toBe(input);
  });
});
