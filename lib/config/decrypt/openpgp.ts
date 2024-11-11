import { openpgp } from '../../expose.cjs';
import { logger } from '../../logger';
import { regEx } from '../../util/regex';

let pgp: typeof import('openpgp') | null | undefined = undefined;

export async function tryDecryptOpenPgp(
  privateKey: string,
  encryptedStr: string,
): Promise<string | null> {
  if (encryptedStr.length < 500) {
    // optimization during transition of public key -> pgp
    return null;
  }
  if (pgp === undefined) {
    try {
      pgp = openpgp();
    } catch (err) {
      logger.warn({ err }, 'Could load openpgp');
      pgp = null;
    }
  }

  if (pgp === null) {
    logger.once.warn('Cannot load openpgp, skipping decryption');
    return null;
  }

  try {
    const pk = await pgp.readPrivateKey({
      // prettier-ignore
      armoredKey: privateKey.replace(regEx(/\n[ \t]+/g), '\n'), // little massage to help a common problem
    });
    const startBlock = '-----BEGIN PGP MESSAGE-----\n\n';
    const endBlock = '\n-----END PGP MESSAGE-----';
    let armoredMessage = encryptedStr.trim();
    if (!armoredMessage.startsWith(startBlock)) {
      armoredMessage = `${startBlock}${armoredMessage}`;
    }
    if (!armoredMessage.endsWith(endBlock)) {
      armoredMessage = `${armoredMessage}${endBlock}`;
    }
    const message = await pgp.readMessage({
      armoredMessage,
    });
    const { data } = await pgp.decrypt({
      message,
      decryptionKeys: pk,
    });
    logger.debug('Decrypted config using openpgp');
    return data;
  } catch (err) {
    logger.debug({ err }, 'Could not decrypt using openpgp');
    return null;
  }
}
