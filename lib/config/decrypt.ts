import {
  isArray,
  isNonEmptyString,
  isObject,
  isString,
} from '@sindresorhus/is';
import { CONFIG_VALIDATION } from '../constants/error-messages';
import { logger } from '../logger';
import { getEnv } from '../util/env';
import { regEx } from '../util/regex';
import { addSecretForSanitizing } from '../util/sanitize';
import { ensureTrailingSlash, parseUrl, trimSlashes } from '../util/url';
import { tryDecryptBcPgp } from './decrypt/bcpgp';
import { tryDecryptOpenPgp } from './decrypt/openpgp';
import { GlobalConfig } from './global';
import { DecryptedObject } from './schema';
import type { RenovateConfig } from './types';

let privateKey: string | undefined;
let privateKeyOld: string | undefined;

export function setPrivateKeys(
  pKey: string | undefined,
  pKeyOld: string | undefined,
): void {
  privateKey = pKey;
  privateKeyOld = pKeyOld;
}

export async function tryDecrypt(
  key: string,
  encryptedStr: string,
  repository: string,
): Promise<string | null> {
  let decryptedStr: string | null = null;
  const decryptedObjStr =
    getEnv().RENOVATE_X_USE_OPENPGP === 'true'
      ? await tryDecryptOpenPgp(key, encryptedStr)
      : await tryDecryptBcPgp(key, encryptedStr);
  if (decryptedObjStr) {
    decryptedStr = validateDecryptedValue(decryptedObjStr, repository);
  }
  return decryptedStr;
}

export function validateDecryptedValue(
  decryptedObjStr: string,
  repository: string,
): string | null {
  try {
    const decryptedObj = DecryptedObject.safeParse(decryptedObjStr);
    if (!decryptedObj.success) {
      const error = new Error('config-validation');
      error.validationError = `Could not parse decrypted config.`;
      throw error;
    }

    const { o: org, r: repo, v: value } = decryptedObj.data;

    if (!isNonEmptyString(value)) {
      const error = new Error('config-validation');
      error.validationError = `Encrypted value in config is missing a value.`;
      throw error;
    }

    if (!isNonEmptyString(org)) {
      const error = new Error('config-validation');
      error.validationError = `Encrypted value in config is missing a scope.`;
      throw error;
    }

    const repositories = [repository.toUpperCase()];

    const azureCollection = getAzureCollection();
    if (isNonEmptyString(azureCollection)) {
      // used for full 'org/project/repo' matching
      repositories.push(`${azureCollection}/${repository}`.toUpperCase());
      // used for org prefix matching without repo
      repositories.push(`${azureCollection}/*/`.toUpperCase());
    }

    const orgPrefixes = org
      .split(',')
      .map((o) => o.trim())
      .map((o) => o.toUpperCase())
      .map((o) => ensureTrailingSlash(o));

    if (isNonEmptyString(repo)) {
      const scopedRepos = orgPrefixes.map((orgPrefix) =>
        `${orgPrefix}${repo}`.toUpperCase(),
      );
      for (const rp of repositories) {
        if (scopedRepos.some((r) => r === rp)) {
          return value;
        }
      }

      logger.debug(
        { scopedRepos },
        'Secret is scoped to a different repository',
      );
      const error = new Error('config-validation');
      const scopeString = scopedRepos.join(',');
      error.validationError = `Encrypted secret is scoped to a different repository: "${scopeString}".`;
      throw error;
    }

    // no scoped repos, only org
    const azcol =
      azureCollection === undefined
        ? undefined
        : ensureTrailingSlash(azureCollection).toUpperCase();
    for (const rp of repositories) {
      if (
        orgPrefixes.some(
          (orgPrefix) => rp.startsWith(orgPrefix) && orgPrefix !== azcol,
        )
      ) {
        return value;
      }
    }
    logger.debug({ orgPrefixes }, 'Secret is scoped to a different org');
    const error = new Error('config-validation');
    const scopeString = orgPrefixes.join(',');
    error.validationError = `Encrypted secret is scoped to a different org: "${scopeString}".`;
    throw error;
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
  for (const [key, val] of Object.entries(config)) {
    if (key === 'encrypted' && isObject(val)) {
      const path = `${existingPath}.${key}`;
      logger.debug({ config: val }, `Found encrypted config in ${path}`);

      const encryptedWarning = GlobalConfig.get('encryptedWarning');
      if (isString(encryptedWarning)) {
        logger.once.warn(encryptedWarning);
      }

      if (privateKey) {
        for (const [eKey, eVal] of Object.entries(val)) {
          logger.debug(`Trying to decrypt ${eKey} in ${path}`);
          let decryptedStr = await tryDecrypt(privateKey, eVal, repository);
          if (privateKeyOld && !isNonEmptyString(decryptedStr)) {
            logger.debug(`Trying to decrypt with old private key`);
            decryptedStr = await tryDecrypt(privateKeyOld, eVal, repository);
          }
          if (!isNonEmptyString(decryptedStr)) {
            const error = new Error('config-validation');
            error.validationError = `Failed to decrypt field ${eKey}. Please re-encrypt and try again.`;
            throw error;
          }
          logger.debug(`Decrypted ${eKey} in ${path}`);
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
        const env = getEnv();
        if (env.RENOVATE_X_ENCRYPTED_STRICT === 'true') {
          const error = new Error(CONFIG_VALIDATION);
          error.validationSource = 'config';
          error.validationError = 'Encrypted config unsupported';
          error.validationMessage = `This config contains an encrypted object at location \`$.${key}\` but no privateKey is configured. To support encrypted config, the Renovate administrator must configure a \`privateKey\` in Global Configuration.`;
          if (env.MEND_HOSTED === 'true') {
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
    } else if (isArray(val)) {
      decryptedConfig[key] = [];
      for (const [index, item] of val.entries()) {
        if (isObject(item) && !isArray(item)) {
          const path = `${existingPath}.${key}[${index}]`;
          (decryptedConfig[key] as RenovateConfig[]).push(
            await decryptConfig(item as RenovateConfig, repository, path),
          );
        } else {
          (decryptedConfig[key] as unknown[]).push(item);
        }
      }
    } else if (isObject(val) && key !== 'content') {
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

export function getAzureCollection(): string | undefined {
  const platform = GlobalConfig.get('platform');
  if (platform !== 'azure') {
    return undefined;
  }

  const endpoint = GlobalConfig.get('endpoint');
  const endpointUrl = parseUrl(endpoint);
  if (endpointUrl === null) {
    // should not happen
    logger.warn({ endpoint }, 'Unable to parse endpoint for token decryption');
    return undefined;
  }

  const azureCollection = trimSlashes(endpointUrl.pathname);
  if (!isNonEmptyString(azureCollection)) {
    logger.debug({ endpoint }, 'Unable to find azure collection name from URL');
    return undefined;
  }

  if (azureCollection.startsWith('tfs/')) {
    // Azure DevOps Server
    return azureCollection.substring(4);
  }
  return azureCollection;
}
