import hasha from 'hasha';

export function toSha256(input: string): string {
  return hasha(input, { algorithm: 'sha256' });
}
