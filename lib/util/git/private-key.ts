import os from 'node:os';
import is from '@sindresorhus/is';
import fs from 'fs-extra';
import upath from 'upath';
import { PLATFORM_GPG_FAILED } from '../../constants/error-messages';
import { logger } from '../../logger';
import { exec } from '../exec';
import { newlineRegex } from '../regex';
import { addSecretForSanitizing } from '../sanitize';

let gitPrivateKey: string | undefined;
let keyId: string | undefined;

export function setPrivateKey(key: string | undefined): void {
  if (!is.nonEmptyStringAndNotWhitespace(key)) {
    return;
  }
  addSecretForSanitizing(key.trim(), 'global');
  logger.debug(
    'gitPrivateKey: successfully set (but not yet written/configured)',
  );
  gitPrivateKey = key.trim();
}

async function importKey(): Promise<void> {
  if (keyId) {
    return;
  }
  const keyFileName = upath.join(os.tmpdir() + '/git-private.key');
  await fs.outputFile(keyFileName, gitPrivateKey!);
  const { stdout, stderr } = await exec(`gpg --import ${keyFileName}`);
  logger.debug({ stdout, stderr }, 'Private key import result');
  keyId = `${stdout}${stderr}`
    .split(newlineRegex)
    .find((line) => line.includes('secret key imported'))
    ?.replace('gpg: key ', '')
    .split(':')
    .shift();
  await fs.remove(keyFileName);
}

export async function writePrivateKey(): Promise<void> {
  if (!gitPrivateKey) {
    return;
  }
  try {
    await importKey();
    logger.debug('gitPrivateKey: imported');
  } catch (err) {
    logger.warn({ err }, 'gitPrivateKey: error importing');
    throw new Error(PLATFORM_GPG_FAILED);
  }
}

export async function configSigningKey(cwd: string): Promise<void> {
  if (!gitPrivateKey) {
    return;
  }
  logger.debug('gitPrivateKey: configuring commit signing');
  // TODO: types (#22198)
  await exec(`git config user.signingkey ${keyId!}`, { cwd });
  await exec(`git config commit.gpgsign true`, { cwd });
}
