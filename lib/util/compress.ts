import { promisify } from 'node:util';
import zlib, { constants } from 'node:zlib';

const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

const brotliOptions = {
  params: {
    [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
    [constants.BROTLI_PARAM_QUALITY]: 8,
  },
};

export async function compressToBuffer(input: string): Promise<Buffer> {
  return await brotliCompress(input, brotliOptions);
}

export async function decompressFromBuffer(input: Buffer): Promise<string> {
  const decompressed = await brotliDecompress(input);
  return decompressed.toString('utf8');
}

export async function compressToBase64(input: string): Promise<string> {
  const buf = await compressToBuffer(input);
  return buf.toString('base64');
}

export async function decompressFromBase64(input: string): Promise<string> {
  const buf = Buffer.from(input, 'base64');
  return await decompressFromBuffer(buf);
}
