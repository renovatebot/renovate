import { chmod, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';

export interface SshKeyPair {
  /** OpenSSH private key path on disk (for GIT_SSH_COMMAND -i) */
  privateKeyPath: string;
  /** OpenSSH public key line (for Gerrit account registration) */
  publicKey: string;
  /** Remove the temporary directory holding the key material */
  dispose: () => Promise<void>;
}

/**
 * Generate a disposable ed25519 key pair for Gerrit SSH Git access.
 */
export async function generateSshKeyPair(): Promise<SshKeyPair> {
  const dir = await mkdtemp(join(tmpdir(), 'renovate-ssh-'));
  const privateKeyPath = join(dir, 'id_ed25519');

  await execa('ssh-keygen', [
    '-t',
    'ed25519',
    '-N',
    '',
    '-f',
    privateKeyPath,
    '-C',
    'renovate-gerrit-integration',
    '-q',
  ]);

  // ssh refuses keys that are group/world-readable
  await chmod(privateKeyPath, 0o600);

  const publicKey = (await readFile(`${privateKeyPath}.pub`, 'utf8')).trim();

  return {
    privateKeyPath,
    publicKey,
    dispose: async () => {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

/** Build a GIT_SSH_COMMAND that uses the given key and skips host checks. */
export function gitSshCommand(privateKeyPath: string): string {
  return [
    'ssh',
    '-i',
    privateKeyPath,
    '-o',
    'BatchMode=yes',
    '-o',
    'StrictHostKeyChecking=no',
    '-o',
    'UserKnownHostsFile=/dev/null',
    '-o',
    'IdentitiesOnly=yes',
  ].join(' ');
}
