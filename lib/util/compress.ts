import { type Readable, type Transform, finished, pipeline } from 'node:stream';
import { promisify } from 'node:util';
import zlib, { constants } from 'node:zlib';

const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

export async function compressToBuffer(
  input: string,
  quality = 8,
): Promise<Buffer> {
  return await brotliCompress(input, {
    params: {
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
      [constants.BROTLI_PARAM_QUALITY]: quality,
    },
  });
}

export async function decompressFromBuffer(input: Buffer): Promise<string> {
  const str = await brotliDecompress(input);
  return str.toString('utf8');
}

export async function compressToBase64(input: string): Promise<string> {
  const buf = await compressToBuffer(input);
  return buf.toString('base64');
}

export async function decompressFromBase64(input: string): Promise<string> {
  return await decompressFromBuffer(Buffer.from(input, 'base64'));
}

function peekHeader(readable: Readable, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    function read(): void {
      const result = readable.read(length);
      if (result) {
        readable.removeListener('readable', read);
        cleanup();
        readable.unshift(result);
        resolve(result);
      }
    }
    readable.on('readable', read);
    const cleanup = finished(
      readable,
      { readable: true, writable: false },
      (err) => {
        readable.removeListener('readable', read);
        cleanup();
        if (err) {
          reject(err);
        } else {
          resolve(Buffer.from([]));
        }
      },
    );
  });
}

const algorithms: { header: Uint8Array; createStream: () => Transform }[] = [
  {
    header: Uint8Array.from([0x1f, 0x8b]),
    createStream: zlib.createGunzip,
  },
  {
    header: Uint8Array.from([0x28, 0xb5, 0x2f, 0xfd]),
    createStream: zlib.createZstdDecompress,
  },
];

const maxHeaderLength = algorithms.reduce(
  (maxLength, { header }) => Math.max(maxLength, header.length),
  0,
);

export async function createDecompressStream(
  input: Readable,
): Promise<Readable> {
  const header = await peekHeader(input, maxHeaderLength);
  const algorithm = algorithms.find(
    (entry) =>
      header.subarray(0, entry.header.length).compare(entry.header) === 0,
  );
  if (!algorithm) {
    return input;
  }
  return pipeline(input, algorithm.createStream(), (err) => {
    input.destroy(err ?? undefined);
  });
}
