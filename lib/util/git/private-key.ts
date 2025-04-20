import os from 'node:os';
import is from '@sindresorhus/is';
import fs from 'fs-extra';
import upath from 'upath';
import { PLATFORM_GPG_FAILED } from '../../constants/error-messages';
import { logger } from '../../logger';
import { exec } from '../exec';
import type { ExecResult } from '../exec/types';
import { newlineRegex, regEx } from '../regex';
import { addSecretForSanitizing } from '../sanitize';

type PrivateKeyFormat = 'gpg' | 'ssh';

const sshKeyRegex = regEx(
  /-----BEGIN ([A-Z ]+ )?PRIVATE KEY-----.*?-----END ([A-Z]+ )?PRIVATE KEY-----/,
  's',
);

let gitPrivateKey: PrivateKey | undefined;

abstract class PrivateKey {
  protected readonly key: string;
  protected keyId: string | undefined;
  protected abstract readonly gpgFormat: string;

  constructor(key: string) {
    this.key = key;
    addSecretForSanitizing(this.key, 'global');
    logger.debug(
      'gitPrivateKey: successfully set (but not yet written/configured)',
    );
  }

  async writeKey(): Promise<void> {
    try {
      this.keyId ??= await this.importKey();
      logger.debug('gitPrivateKey: imported');
    } catch (err) {
      logger.warn({ err }, 'gitPrivateKey: error importing');
      throw new Error(PLATFORM_GPG_FAILED);
    }
  }

  async configSigningKey(cwd: string): Promise<void> {
    logger.debug('gitPrivateKey: configuring commit signing');
    // TODO: types (#22198)
    await exec(`git config user.signingkey ${this.keyId!}`, { cwd });
    await exec(`git config commit.gpgsign true`, { cwd });
    await exec(`git config gpg.format ${this.gpgFormat}`, { cwd });
  }

  protected abstract importKey(): Promise<string | undefined>;
}

class GPGKey extends PrivateKey {
  protected readonly gpgFormat = 'openpgp';

  constructor(key: string) {
    super(key.trim());
  }

  protected async importKey(): Promise<string | undefined> {
    const keyFileName = upath.join(os.tmpdir() + '/git-private-gpg.key');
    await fs.outputFile(keyFileName, this.key);
    const { stdout, stderr } = await exec(
      // --batch --no-tty flags allow Renovate to skip warnings about unsupported algorithms in the key
      `gpg --batch --no-tty --import ${keyFileName}`,
    );
    logger.debug({ stdout, stderr }, 'Private key import result');
    await fs.remove(keyFileName);
    return `${stdout}${stderr}`
      .split(newlineRegex)
      .find((line) => line.includes('secret key imported'))
      ?.replace('gpg: key ', '')
      .split(':')
      .shift();
  }
}

class SSHKey extends PrivateKey {
  protected readonly gpgFormat = 'ssh';

  protected async importKey(): Promise<string | undefined> {
    const keyFileName = upath.join(os.tmpdir() + '/git-private-ssh.key');
    if (await this.hasPassphrase(keyFileName)) {
      throw new Error('SSH key must have an empty passhprase');
    }
    await fs.outputFile(keyFileName, this.key.replace(/\n?$/, '\n'));
    process.on('exit', () => fs.removeSync(keyFileName));
    await fs.chmod(keyFileName, 0o600);
    // HACK: `git` calls `ssh-keygen -Y sign ...` internally for SSH-based
    // commit signing. Technically, only the private key is needed for signing,
    // but `ssh-keygen` has an implementation quirk which requires also the
    // public key file to exist. Therefore, we derive the public key from the
    // private key just to satisfy `ssh-keygen` until the problem has been
    // resolved.
    // https://github.com/renovatebot/renovate/issues/18197#issuecomment-2152333710
    const { stdout } = await exec(`ssh-keygen -y -P "" -f ${keyFileName}`);
    const pubFileName = `${keyFileName}.pub`;
    await fs.outputFile(pubFileName, stdout);
    process.on('exit', () => fs.removeSync(pubFileName));
    return keyFileName;
  }

  private async hasPassphrase(keyFileName: string): Promise<boolean> {
    try {
      await exec(`ssh-keygen -y -P "" -f ${keyFileName}`);
    } catch (err) {
      return (err as ExecResult).stderr.includes(
        'incorrect passphrase supplied to decrypt private key',
      );
    }
    return false;
  }
}

function getPrivateKeyFormat(key: string): PrivateKeyFormat {
  return sshKeyRegex.test(key) ? 'ssh' : 'gpg';
}

function createPrivateKey(key: string): PrivateKey {
  switch (getPrivateKeyFormat(key)) {
    case 'gpg':
      logger.debug('gitPrivateKey: GPG key detected');
      return new GPGKey(key);
    case 'ssh':
      logger.debug('gitPrivateKey: SSH key detected');
      return new SSHKey(key);
  }
}

export function setPrivateKey(key: string | undefined): void {
  if (!is.nonEmptyStringAndNotWhitespace(key)) {
    return;
  }
  gitPrivateKey = createPrivateKey(key);
}

export async function writePrivateKey(): Promise<void> {
  await gitPrivateKey?.writeKey();
}

export async function configSigningKey(cwd: string): Promise<void> {
  await gitPrivateKey?.configSigningKey(cwd);
}
