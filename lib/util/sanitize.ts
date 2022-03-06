import is from '@sindresorhus/is';
import { toBase64 } from './string';

const secrets = new Set<string>();

export const redactedFields = [
  'authorization',
  'token',
  'githubAppKey',
  'npmToken',
  'npmrc',
  'privateKey',
  'privateKeyOld',
  'gitPrivateKey',
  'forkToken',
  'password',
];

export function sanitize(input: string): string {
  if (!input) {
    return input;
  }
  let output: string = input;
  secrets.forEach((secret) => {
    while (output.includes(secret)) {
      output = output.replace(secret, '**redacted**');
    }
  });
  return output;
}

const GITHUB_APP_TOKEN_PREFIX = 'x-access-token:';

export function addSecretForSanitizing(secret: string): void {
  if (!is.nonEmptyString(secret)) {
    return;
  }
  secrets.add(secret);
  secrets.add(toBase64(secret));
  if (secret.startsWith(GITHUB_APP_TOKEN_PREFIX)) {
    const trimmedSecret = secret.replace(GITHUB_APP_TOKEN_PREFIX, '');
    secrets.add(trimmedSecret);
    secrets.add(toBase64(trimmedSecret));
  }
}

export function clearSanitizedSecretsList(): void {
  secrets.clear();
}
