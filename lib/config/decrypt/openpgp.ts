import * as openpgp from 'openpgp';
import { logger } from '../../logger';
import { regEx } from '../../util/regex';

export async function tryDecryptOpenPgp(
  privateKey: string,
  encryptedStr: string,
): Promise<string | null> {
  if (encryptedStr.length < 500) {
    // optimization during transition of public key -> pgp
    return null;
  }
  try {
    const pk = await openpgp.readPrivateKey({
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
    const message = await openpgp.readMessage({
      armoredMessage,
    });
    const { data } = await openpgp.decrypt({
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
