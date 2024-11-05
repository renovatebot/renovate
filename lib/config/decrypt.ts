import is from '@sindresorhus/is';
import { logger } from '../logger';
import * as memCache from '../util/cache/memory';
import { maskToken } from '../util/mask';
import { regEx } from '../util/regex';
import { addSecretForSanitizing } from '../util/sanitize';
import { ensureTrailingSlash } from '../util/url';
import { tryDecryptKbPgp } from './decrypt/kbpgp';
import {
  tryDecryptPublicKeyDefault,
  tryDecryptPublicKeyPKCS1,
} from './decrypt/legacy';
import { tryDecryptOpenPgp } from './decrypt/openpgp';
import { GlobalConfig } from './global';
import { DecryptedObject } from './schema';
import type { RenovateConfig } from './types';

export async function tryDecrypt(
  privateKey: string,
  encryptedStr: string,
  repository: string,
  keyName: string,
): Promise<string | null> {
  let decryptedStr: string | null = null;
  if (privateKey?.startsWith('-----BEGIN PGP PRIVATE KEY BLOCK-----')) {
    const decryptedObjStr =
      process.env.RENOVATE_X_USE_OPENPGP === 'true'
        ? await tryDecryptOpenPgp(privateKey, encryptedStr)
        : await tryDecryptKbPgp(privateKey, encryptedStr);
    if (decryptedObjStr) {
      decryptedStr = validateDecryptedValue(decryptedObjStr, repository);
    }
  } else {
    decryptedStr = tryDecryptPublicKeyDefault(privateKey, encryptedStr);
    if (is.string(decryptedStr)) {
      logger.warn(
        { keyName },
        'Encrypted value is using deprecated default padding, please change to using PGP encryption.',
      );
    } else {
      decryptedStr = tryDecryptPublicKeyPKCS1(privateKey, encryptedStr);
      // istanbul ignore if
      if (is.string(decryptedStr)) {
        logger.warn(
          { keyName },
          'Encrypted value is using deprecated PKCS1 padding, please change to using PGP encryption.',
        );
      }
    }
  }
  return decryptedStr;
}

function validateDecryptedValue(
  decryptedObjStr: string,
  repository: string,
): string | null {
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
            return value;
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
            return value;
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
  return null;
}

export async function decryptConfig(
  config: RenovateConfig,
  repository: string,
  existingPath = '$',
): Promise<RenovateConfig> {
  logger.trace({ config }, 'decryptConfig()');
  const decryptedConfig = { ...config };
  const privateKey = GlobalConfig.get('privateKey');
  const privateKeyOld = GlobalConfig.get('privateKeyOld');
  for (const [key, val] of Object.entries(config)) {
    if (key === 'encrypted' && is.object(val)) {
      const path = `${existingPath}.${key}`;
      logger.debug({ config: val }, `Found encrypted config in ${path}`);

      const encryptedWarning = GlobalConfig.get('encryptedWarning');
      if (is.string(encryptedWarning)) {
        logger.once.warn(encryptedWarning);
      }

      if (privateKey) {
        for (const [eKey, eVal] of Object.entries(val)) {
          logger.debug(`Trying to decrypt ${eKey} in ${path}`);
          let decryptedStr = await tryDecrypt(
            privateKey,
            eVal,
            repository,
            eKey,
          );
          if (privateKeyOld && !is.nonEmptyString(decryptedStr)) {
            logger.debug(`Trying to decrypt with old private key`);
            decryptedStr = await tryDecrypt(
              privateKeyOld,
              eVal,
              repository,
              eKey,
            );
          }
          if (!is.nonEmptyString(decryptedStr)) {
            const error = new Error('config-validation');
            error.validationError = `Failed to decrypt field ${eKey}. Please re-encrypt and try again.`;
            throw error;
          }
          logger.debug(`Decrypted ${eKey} in ${path}`);
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
      for (const [index, item] of val.entries()) {
        if (is.object(item) && !is.array(item)) {
          const path = `${existingPath}.${key}[${index}]`;
          (decryptedConfig[key] as RenovateConfig[]).push(
            await decryptConfig(item as RenovateConfig, repository, path),
          );
        } else {
          (decryptedConfig[key] as unknown[]).push(item);
        }
      }
    } else if (is.object(val) && key !== 'content') {
      const path = `${existingPath}.${key}`;
      decryptedConfig[key] = await decryptConfig(
        val as RenovateConfig,
        repository,
        path,
      );
    }
  }
  delete decryptedConfig.encrypted;
  logger.trace({ config: decryptedConfig }, 'decryptedConfig');
  return decryptedConfig;
}
