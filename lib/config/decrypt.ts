import crypto from 'node:crypto';
import is from '@sindresorhus/is';
import * as openpgp from 'openpgp';
import { logger } from '../logger';
import { maskToken } from '../util/mask';
import { regEx } from '../util/regex';
import { addSecretForSanitizing } from '../util/sanitize';
import { ensureTrailingSlash } from '../util/url';
import { GlobalConfig } from './global';
import { DecryptedObject } from './schema';
import type { RenovateConfig } from './types';

export async function tryDecryptPgp(
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
  } catch (err) {
    logger.debug('Could not decrypt using default padding');
  }
  return decryptedStr;
}

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
  } catch (err) {
    logger.debug('Could not decrypt using PKCS1 padding');
  }
  return decryptedStr;
}

export async function tryDecrypt(
  privateKey: string,
  encryptedStr: string,
  repository: string,
): Promise<string | null> {
  let decryptedStr: string | null = null;
  if (privateKey?.startsWith('-----BEGIN PGP PRIVATE KEY BLOCK-----')) {
    const decryptedObjStr = await tryDecryptPgp(privateKey, encryptedStr);
    if (decryptedObjStr) {
      try {
        const decryptedObj = DecryptedObject.safeParse(decryptedObjStr);
        // istanbul ignore if
        if (!decryptedObj.success) {
          const error = new Error('config-validation');
          error.validationError = `Could not parse decrypted config.`;
          throw error;
        }

        const { o: org, r: repo, v: value } = decryptedObj.data;
        if (is.nonEmptyString(value)) {
          if (is.nonEmptyString(org)) {
            const orgPrefixes = org
              .split(',')
              .map((o) => o.trim())
              .map((o) => o.toUpperCase())
              .map((o) => ensureTrailingSlash(o));
            if (is.nonEmptyString(repo)) {
              const scopedRepos = orgPrefixes.map((orgPrefix) =>
                `${orgPrefix}${repo}`.toUpperCase(),
              );
              if (scopedRepos.some((r) => r === repository.toUpperCase())) {
                decryptedStr = value;
              } else {
                logger.debug(
                  { scopedRepos },
                  'Secret is scoped to a different repository',
                );
                const error = new Error('config-validation');
                error.validationError = `Encrypted secret is scoped to a different repository: "${scopedRepos.join(
                  ',',
                )}".`;
                throw error;
              }
            } else {
              if (
                orgPrefixes.some((orgPrefix) =>
                  repository.toUpperCase().startsWith(orgPrefix),
                )
              ) {
                decryptedStr = value;
              } else {
                logger.debug(
                  { orgPrefixes },
                  'Secret is scoped to a different org',
                );
                const error = new Error('config-validation');
                error.validationError = `Encrypted secret is scoped to a different org: "${orgPrefixes.join(
                  ',',
                )}".`;
                throw error;
              }
            }
          } else {
            const error = new Error('config-validation');
            error.validationError = `Encrypted value in config is missing a scope.`;
            throw error;
          }
        } else {
          const error = new Error('config-validation');
          error.validationError = `Encrypted value in config is missing a value.`;
          throw error;
        }
      } catch (err) {
        logger.warn({ err }, 'Could not parse decrypted string');
      }
    }
  } else {
    decryptedStr = tryDecryptPublicKeyDefault(privateKey, encryptedStr);
    if (!is.string(decryptedStr)) {
      decryptedStr = tryDecryptPublicKeyPKCS1(privateKey, encryptedStr);
    }
  }
  return decryptedStr;
}

export async function decryptConfig(
  config: RenovateConfig,
  repository: string,
): Promise<RenovateConfig> {
  logger.trace({ config }, 'decryptConfig()');
  const decryptedConfig = { ...config };
  const privateKey = GlobalConfig.get('privateKey');
  const privateKeyOld = GlobalConfig.get('privateKeyOld');
  for (const [key, val] of Object.entries(config)) {
    if (key === 'encrypted' && is.object(val)) {
      logger.debug({ config: val }, 'Found encrypted config');
      if (privateKey) {
        for (const [eKey, eVal] of Object.entries(val)) {
          logger.debug('Trying to decrypt ' + eKey);
          let decryptedStr = await tryDecrypt(privateKey, eVal, repository);
          if (privateKeyOld && !is.nonEmptyString(decryptedStr)) {
            logger.debug(`Trying to decrypt with old private key`);
            decryptedStr = await tryDecrypt(privateKeyOld, eVal, repository);
          }
          if (!is.nonEmptyString(decryptedStr)) {
            const error = new Error('config-validation');
            error.validationError = `Failed to decrypt field ${eKey}. Please re-encrypt and try again.`;
            throw error;
          }
          logger.debug(`Decrypted ${eKey}`);
          if (eKey === 'npmToken') {
            const token = decryptedStr.replace(regEx(/\n$/), '');
            addSecretForSanitizing(token);
            logger.debug(
              { decryptedToken: maskToken(token) },
              'Migrating npmToken to npmrc',
            );
            if (is.string(decryptedConfig.npmrc)) {
              /* eslint-disable no-template-curly-in-string */
              if (decryptedConfig.npmrc.includes('${NPM_TOKEN}')) {
                logger.debug('Replacing ${NPM_TOKEN} with decrypted token');
                decryptedConfig.npmrc = decryptedConfig.npmrc.replace(
                  regEx(/\${NPM_TOKEN}/g),
                  token,
                );
              } else {
                logger.debug('Appending _authToken= to end of existing npmrc');
                decryptedConfig.npmrc = decryptedConfig.npmrc.replace(
                  regEx(/\n?$/),
                  `\n_authToken=${token}\n`,
                );
              }
              /* eslint-enable no-template-curly-in-string */
            } else {
              logger.debug('Adding npmrc to config');
              decryptedConfig.npmrc = `//registry.npmjs.org/:_authToken=${token}\n`;
            }
          } else {
            decryptedConfig[eKey] = decryptedStr;
            addSecretForSanitizing(decryptedStr);
          }
        }
      } else {
        logger.error('Found encrypted data but no privateKey');
      }
      delete decryptedConfig.encrypted;
    } else if (is.array(val)) {
      decryptedConfig[key] = [];
      for (const item of val) {
        if (is.object(item) && !is.array(item)) {
          (decryptedConfig[key] as RenovateConfig[]).push(
            await decryptConfig(item as RenovateConfig, repository),
          );
        } else {
          (decryptedConfig[key] as unknown[]).push(item);
        }
      }
    } else if (is.object(val) && key !== 'content') {
      decryptedConfig[key] = await decryptConfig(
        val as RenovateConfig,
        repository,
      );
    }
  }
  delete decryptedConfig.encrypted;
  logger.trace({ config: decryptedConfig }, 'decryptedConfig');
  return decryptedConfig;
}
