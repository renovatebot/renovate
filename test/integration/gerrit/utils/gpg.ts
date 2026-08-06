import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';

export interface GpgKeyPair {
  /** ASCII-armored secret key (for Renovate gitPrivateKey) */
  secretKey: string;
  /** ASCII-armored public key (for Gerrit account registration) */
  publicKey: string;
  email: string;
  name: string;
  /** Temporary GNUPGHOME used to generate the key — call dispose() when done */
  dispose: () => Promise<void>;
}

/**
 * Generate a disposable OpenPGP key pair in an isolated GNUPGHOME.
 * Inspired by the reproduction in eclipse-jgit/jgit#222.
 */
export async function generateGpgKeyPair(
  name: string,
  email: string,
): Promise<GpgKeyPair> {
  const homedir = await mkdtemp(join(tmpdir(), 'renovate-gpg-'));

  async function gpg(...args: string[]) {
    return execa('gpg', ['--homedir', homedir, '--batch', '--yes', ...args], {
      env: { GNUPGHOME: homedir },
    });
  }

  // Non-expiring RSA key, no passphrase (batch mode)
  await gpg(
    '--passphrase',
    '',
    '--pinentry-mode',
    'loopback',
    '--quick-generate-key',
    `${name} <${email}>`,
    'rsa4096',
    'default',
    'never',
  );

  const { stdout: secretKey } = await gpg(
    '--armor',
    '--export-secret-keys',
    email,
  );
  const { stdout: publicKey } = await gpg('--armor', '--export', email);

  return {
    secretKey,
    publicKey,
    email,
    name,
    dispose: async () => {
      await rm(homedir, { recursive: true, force: true });
    },
  };
}
