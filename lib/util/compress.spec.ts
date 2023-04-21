import { compress, decompress } from './compress';

describe('util/compress', () => {
  it('works', async () => {
    const input = 'foobar';

    const compressed = await compress(input);
    expect(compressed).toBe('iwKAZm9vYmFyAw==');

    const decompressed = await decompress(compressed);
    expect(decompressed).toBe(input);
  });
});
