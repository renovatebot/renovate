import { compressToBase64, decompressFromBase64 } from './compress';

describe('util/compress', () => {
  it('compresses strings', async () => {
    const input = 'foobar';

    const compressed = await compressToBase64(input);
    expect(compressed).toBe('iwKAZm9vYmFyAw==');

    const decompressed = await decompressFromBase64(compressed);
    expect(decompressed).toBe(input);
  });

  it('compresses objects', async () => {
    const input = { foo: 'bar' };

    const compressed = await compressToBase64(input);
    expect(compressed).toBe('CwaAeyJmb28iOiJiYXIifQM=');

    const decompressed = await decompressFromBase64(compressed);
    expect(JSON.parse(decompressed)).toEqual(input);
  });
});
