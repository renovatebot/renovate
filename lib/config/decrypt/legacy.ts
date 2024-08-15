/** istanbul ignore file */
import crypto from 'node:crypto';
import { logger } from '../../logger';

export function tryDecryptPublicKeyPKCS1(
  privateKey: string,
  encryptedStr: string,
): string | null {
  let decryptedStr: string | null = null;
  try {
    decryptedStr = crypto
      .privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        Buffer.from(encryptedStr, 'base64'),
      )
      .toString();
  } catch {
    logger.debug('Could not decrypt using PKCS1 padding');
  }
  return decryptedStr;
}

export function tryDecryptPublicKeyDefault(
  privateKey: string,
  encryptedStr: string,
): string | null {
  let decryptedStr: string | null = null;
  try {
    decryptedStr = crypto
      .privateDecrypt(privateKey, Buffer.from(encryptedStr, 'base64'))
      .toString();
    logger.debug('Decrypted config using default padding');
  } catch {
    logger.debug('Could not decrypt using default padding');
  }
  return decryptedStr;
}
