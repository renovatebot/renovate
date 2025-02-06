import { promisify } from 'node:util';
import zlib, { constants } from 'node:zlib';

const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

export async function compressToBase64(input: string): Promise<string> {
  const buf = await brotliCompress(input, {
    params: {
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
      [constants.BROTLI_PARAM_QUALITY]: 8,
    },
  });
  return buf.toString('base64');
}

export async function decompressFromBase64(input: string): Promise<string> {
  const buf = Buffer.from(input, 'base64');
  const str = await brotliDecompress(buf);
  return str.toString('utf8');
}
