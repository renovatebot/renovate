import is from '@sindresorhus/is';
import { CONFIG_VALIDATION } from '../constants/error-messages';
import { logger } from '../logger';
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
): Promise<RenovateConfig> {
  logger.trace({ config }, 'decryptConfig()');
  const decryptedConfig = { ...config };
  const privateKey = GlobalConfig.get('privateKey');
  const privateKeyOld = GlobalConfig.get('privateKeyOld');
  for (const [key, val] of Object.entries(config)) {
    if (key === 'encrypted' && is.object(val)) {
      logger.debug({ config: val }, 'Found encrypted config');

      const encryptedWarning = GlobalConfig.get('encryptedWarning');
      if (is.string(encryptedWarning)) {
        logger.once.warn(encryptedWarning);
      }

      if (privateKey) {
        for (const [eKey, eVal] of Object.entries(val)) {
          logger.debug('Trying to decrypt ' + eKey);
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
          logger.debug(`Decrypted ${eKey}`);
          if (eKey === 'npmToken') {
            const token = decryptedStr.replace(regEx(/\n$/), '');
            decryptedConfig[eKey] = token;
            addSecretForSanitizing(token);
          } else {
            decryptedConfig[eKey] = decryptedStr;
            addSecretForSanitizing(decryptedStr);
          }
        }
      } else {
        if (process.env.RENOVATE_X_ENCRYPTED_STRICT === 'true') {
          const error = new Error(CONFIG_VALIDATION);
          error.validationSource = 'config';
          error.validationError = 'Encrypted config unsupported';
          error.validationMessage = `This config contains an encrypted object at location \`$.${key}\` but no privateKey is configured. To support encrypted config, the Renovate administrator must configure a \`privateKey\` in Global Configuration.`;
          if (process.env.MEND_HOSTED === 'true') {
            error.validationMessage = `Mend-hosted Renovate Apps no longer support the use of encrypted secrets in Renovate file config (e.g. renovate.json).
Please migrate all secrets to the Developer Portal using the web UI available at https://developer.mend.io/

Refer to migration documents here: https://docs.renovatebot.com/mend-hosted/migrating-secrets/`;
          }
          throw error;
        } else {
          logger.error('Found encrypted data but no privateKey');
        }
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
