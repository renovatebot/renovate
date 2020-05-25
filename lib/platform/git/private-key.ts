import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import { PLATFORM_GPG_FAILED } from '../../constants/error-messages';
import { logger } from '../../logger';
import { exec } from '../../util/exec';

let gitPrivateKey: string;

export function setPrivateKey(key: string): void {
  gitPrivateKey = key;
}

export async function writePrivateKey(cwd: string): Promise<void> {
  if (!gitPrivateKey) {
    return;
  }
  logger.debug('Setting git private key');
  try {
    const keyFileName = path.join(os.tmpdir() + '/git-private.key');
    await fs.outputFile(keyFileName, gitPrivateKey);
    const { stdout, stderr } = await exec(`gpg --import ${keyFileName}`);
    logger.debug({ stdout, stderr }, 'Private key import result');
    const keyId = stderr
      .split('\n')
      .find((line) => line.includes('secret key imported'))
      .replace('gpg: key ', '')
      .split(':')
      .shift();
    await fs.remove(keyFileName);
    await exec(`git config user.signingkey ${keyId}`, { cwd });
    await exec(`git config commit.gpgsign true`, { cwd });
  } catch (err) {
    logger.warn({ err }, 'Error writing git private key');
    throw new Error(PLATFORM_GPG_FAILED);
  }
}
