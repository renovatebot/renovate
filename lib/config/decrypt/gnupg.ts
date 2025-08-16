import os from 'node:os';
import { isNonEmptyStringAndNotWhitespace } from '@sindresorhus/is';
import { mkdtemp, outputFile, rm } from 'fs-extra';
import { quote } from 'shlex';
import upath from 'upath';
import { logger } from '../../logger';
import { exec } from '../../util/exec';

const keyImported = new Set<string>();

export async function tryDecryptGnupg(
  privateKey: string,
  encryptedStr: string,
): Promise<string | null> {
  const tmpDir = await mkdtemp(upath.join(os.tmpdir(), 'renovate-gpg-'));

  if (!keyImported.has(privateKey)) {
    try {
      const keyFilePath = upath.join(tmpDir, 'key.pem');
      await outputFile(keyFilePath, privateKey);
      const { stdout, stderr } = await exec(
        `gpg --batch --no-tty --yes --import ${quote(keyFilePath)}`,
      );
      keyImported.add(privateKey);

      logger.debug({ stdout, stderr }, 'Private key import result');
    } catch (err) {
      logger.debug(`Private key import failed: ${err.message}`);
      // cleanup temp dir
      await rm(tmpDir, { recursive: true, force: true });
      return null;
    }
  }
  try {
    const startBlock = '-----BEGIN PGP MESSAGE-----\n\n';
    const endBlock = '\n-----END PGP MESSAGE-----\n';
    let armoredMessage = encryptedStr.trim();
    if (!armoredMessage.startsWith(startBlock)) {
      armoredMessage = `${startBlock}${armoredMessage}`;
    }
    if (!armoredMessage.endsWith(endBlock)) {
      armoredMessage = `${armoredMessage}${endBlock}`;
    }
    const encryptedFilePath = upath.join(tmpDir, 'msg.pem');
    await outputFile(encryptedFilePath, armoredMessage);

    const { stdout, stderr } = await exec(
      `gpg --batch --no-tty --yes --decrypt ${quote(encryptedFilePath)}`,
    );

    logger.debug({ stderr }, 'Decrypted config using gnupg');
    return stdout;
  } catch (err) {
    if (
      'exitCode' in err &&
      err.exitCode === 2 &&
      isNonEmptyStringAndNotWhitespace(err.stdout)
    ) {
      // gpg returns exit code 2 when it cannot fully decrypt the message, but stdout may contain what we need
      logger.debug(
        `Decryption failed, but stdout is available: ${err.message}`,
      );
      return err.stdout;
    }
    logger.debug(`Decryption failed using gnupg: ${err.message}`);
    return null;
    /* v8 ignore next -- coverage bug */
  } finally {
    // cleanup temp dir
    await rm(tmpDir, { recursive: true, force: true });
  }
}
