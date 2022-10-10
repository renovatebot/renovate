import { promisify } from 'util';
import zlib from 'zlib';

const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

export async function compress(input: string): Promise<string> {
  const buf = await brotliCompress(input);
  return buf.toString('base64');
}

export async function decompress(input: string): Promise<string> {
  const buf = Buffer.from(input, 'base64');
  const str = await brotliDecompress(buf);
  return str.toString('utf8');
}
