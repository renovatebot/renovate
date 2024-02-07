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
  'httpsCertificate',
  'httpsPrivateKey',
  'httpsCertificateAuthority',
];

// TODO: returns null or undefined only when input is null or undefined.
export function sanitize(input: string): string;
export function sanitize(
  input: string | null | undefined,
): string | null | undefined;
export function sanitize(
  input: string | null | undefined,
): string | null | undefined {
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

export function addSecretForSanitizing(
  secret: string | undefined,
  type = 'repo',
): void {
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

export function clearRepoSanitizedSecretsList(): void {
  repoSecrets.clear();
}

export function clearGlobalSanitizedSecretsList(): void {
  globalSecrets.clear();
}
