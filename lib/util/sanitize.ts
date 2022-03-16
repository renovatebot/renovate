import is from '@sindresorhus/is';
import { toBase64 } from './string';

const globalSecrets = new Set<string>();
const repoSecrets = new Set<string>();

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
  'Private-token',
];

export function sanitize(input: string): string {
  if (!input) {
    return input;
  }
  let output: string = input;
  [globalSecrets, repoSecrets].forEach((secrets) => {
    secrets.forEach((secret) => {
      while (output.includes(secret)) {
        output = output.replace(secret, '**redacted**');
      }
    });
  });
  return output;
}

const GITHUB_APP_TOKEN_PREFIX = 'x-access-token:';

export function addSecretForSanitizing(secret: string, type = 'repo'): void {
  if (!is.nonEmptyString(secret)) {
    return;
  }
  const secrets = type === 'repo' ? repoSecrets : globalSecrets;
  secrets.add(secret);
  secrets.add(toBase64(secret));
  if (secret.startsWith(GITHUB_APP_TOKEN_PREFIX)) {
    const trimmedSecret = secret.replace(GITHUB_APP_TOKEN_PREFIX, '');
    secrets.add(trimmedSecret);
    secrets.add(toBase64(trimmedSecret));
  }
}

export function clearSanitizedSecretsList(type = 'repo'): void {
  const secrets = type === 'repo' ? repoSecrets : globalSecrets;
  secrets.clear();
}
