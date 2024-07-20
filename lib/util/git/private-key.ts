import os from 'node:os';
import is from '@sindresorhus/is';
import fs from 'fs-extra';
import upath from 'upath';
import { PLATFORM_GPG_FAILED } from '../../constants/error-messages';
import { logger } from '../../logger';
import { exec } from '../exec';
import { newlineRegex } from '../regex';
import { addSecretForSanitizing } from '../sanitize';

let gitPrivateKey: PrivateKey | undefined;

abstract class PrivateKey {
  protected readonly key: string;
  protected keyId: string | undefined;

  constructor(key: string) {
    this.key = key.trim();
    addSecretForSanitizing(this.key, 'global');
    logger.debug(
      'gitPrivateKey: successfully set (but not yet written/configured)',
    );
  }

  async writeKey(): Promise<void> {
    try {
      if (!this.keyId) {
        this.keyId = await this.importKey();
      }
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
  }

  protected abstract importKey(): Promise<string | undefined>;
}

class GPGKey extends PrivateKey {
  protected async importKey(): Promise<string | undefined> {
    const keyFileName = upath.join(os.tmpdir() + '/git-private-gpg.key');
    await fs.outputFile(keyFileName, this.key);
    const { stdout, stderr } = await exec(`gpg --import ${keyFileName}`);
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

export function setPrivateKey(key: string | undefined): void {
  if (!is.nonEmptyStringAndNotWhitespace(key)) {
    return;
  }
  gitPrivateKey = new GPGKey(key);
}

export async function writePrivateKey(): Promise<void> {
  await gitPrivateKey?.writeKey();
}

export async function configSigningKey(cwd: string): Promise<void> {
  await gitPrivateKey?.configSigningKey(cwd);
}
