import os from 'os';
import fs from 'fs-extra';
import upath from 'upath';
import { PLATFORM_GPG_FAILED } from '../../constants/error-messages';
import { logger } from '../../logger';
import { exec } from '../exec';

let gitPrivateKey: string;
let keyId: string;

export function setPrivateKey(key: string): void {
  gitPrivateKey = key;
}

async function importKey(): Promise<void> {
  if (keyId) {
    return;
  }
  const keyFileName = upath.join(os.tmpdir() + '/git-private.key');
  await fs.outputFile(keyFileName, gitPrivateKey);
  const { stdout, stderr } = await exec(`gpg --import ${keyFileName}`);
  logger.debug({ stdout, stderr }, 'Private key import result');
  keyId = (stdout + stderr)
    .split('\n')
    .find((line) => line.includes('secret key imported'))
    .replace('gpg: key ', '')
    .split(':')
    .shift();
  await fs.remove(keyFileName);
}

export async function writePrivateKey(): Promise<void> {
  if (!gitPrivateKey) {
    return;
  }
  logger.debug('Setting git private key');
  try {
    await importKey();
  } catch (err) {
    logger.warn({ err }, 'Error writing git private key');
    throw new Error(PLATFORM_GPG_FAILED);
  }
}

export async function configSigningKey(cwd: string): Promise<void> {
  if (!gitPrivateKey) {
    return;
  }
  logger.debug('Configuring commits signing');
  await exec(`git config user.signingkey ${keyId}`, { cwd });
  await exec(`git config commit.gpgsign true`, { cwd });
}
