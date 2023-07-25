import crypto from 'node:crypto';
import type { LiteralUnion } from 'type-fest';

const defaultAlgorithm: AlgorithmName = 'sha512';

export type AlgorithmName = LiteralUnion<
  'sha1' | 'sha224' | 'sha256' | 'sha384' | 'sha512',
  string
>;

export function hash(data: string | Buffer, algorithm?: AlgorithmName): string {
  const selectedAlgorithm = algorithm ?? defaultAlgorithm;

  const hash = crypto.createHash(selectedAlgorithm);
  hash.update(data);
  return hash.digest('hex');
}

export function toSha256(input: string): string {
  return hash(input, 'sha256');
}
