import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import type { LiteralUnion } from 'type-fest';

export type AlgorithmName = LiteralUnion<
  'sha1' | 'sha224' | 'sha256' | 'sha384' | 'sha512',
  string
>;

export function hash(
  data: string | Buffer,
  algorithm: AlgorithmName = 'sha512',
): string {
  const hash = crypto.createHash(algorithm);
  hash.update(data);
  return hash.digest('hex');
}

export function toSha256(input: string): string {
  return hash(input, 'sha256');
}

export async function hashStream(
  inputStream: NodeJS.ReadableStream,
  algorithm: AlgorithmName = 'sha512',
): Promise<string> {
  const hash = crypto.createHash(algorithm);
  await pipeline(inputStream, hash);
  return hash.digest('hex');
}
