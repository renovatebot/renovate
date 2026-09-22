import { PassThrough, Readable } from 'node:stream';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import {
  compressToBase64,
  compressToBuffer,
  createDecompressStream,
  decompressFromBase64,
  decompressFromBuffer,
} from './compress.ts';
import { streamToString } from './streams.ts';

const gzip = promisify(zlib.gzip);
const zstdCompress = promisify(zlib.zstdCompress);

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
    expect(compressed.toString('base64')).toBe('iwKAZm9vYmFyAw==');

    const decompressed = await decompressFromBuffer(compressed);
    expect(decompressed).toBe(input);
  });

  describe('createDecompressStream', () => {
    it.each(['', 'foo', 'foob', 'foobar'])(
      'autodetects and passes through non-compressed stream with data %j',
      async (input) => {
        const noncompressedStream = Readable.from(Buffer.from(input), {
          objectMode: false,
        });
        const decompressStream =
          await createDecompressStream(noncompressedStream);
        expect(decompressStream).toBe(noncompressedStream);
        const decompressed = await streamToString(decompressStream);
        expect(decompressed).toBe(input);
      },
    );

    it.each([
      { name: 'gzip', compress: gzip },
      { name: 'zstdCompress', compress: zstdCompress },
    ])(
      'autodetects and decompresses stream of data compressed with $name',
      async ({ compress }) => {
        const input = 'foobarbarfoofoobarfoobarfoobarfoobarfoobar!';
        const compressedStream = Readable.from(await compress(input), {
          objectMode: false,
        });
        const decompressed = await streamToString(
          await createDecompressStream(compressedStream),
        );
        expect(decompressed).toBe(input);
      },
    );

    it('rejects if input stream fails before any data', async () => {
      const error = new Error('stream error');
      const inputStream = new PassThrough({ objectMode: false });

      const result = createDecompressStream(inputStream);
      inputStream.destroy(error);

      await expect(result).rejects.toThrow(error);
    });

    it('rejects if input stream fails after the magic number', async () => {
      const error = new Error('stream error');
      const inputStream = new PassThrough({ objectMode: false });

      inputStream.write(Uint8Array.from([0x1f, 0x8b, 0xab, 0xbc, 0xcd]));
      const decompressor = await createDecompressStream(inputStream);

      expect(decompressor).toBeInstanceOf(zlib.Gunzip);

      inputStream.destroy(error);

      await expect(decompressor.toArray()).rejects.toThrow(error);
    });
  });
});
