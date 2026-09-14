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
