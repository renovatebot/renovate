import crypto from 'crypto';
import is from '@sindresorhus/is';
import { logger } from '../logger';
import { maskToken } from '../util/mask';
import { add } from '../util/sanitize';
import { getAdminConfig } from './admin';
import type { RenovateConfig } from './types';

export function decryptConfig(config: RenovateConfig): RenovateConfig {
  logger.trace({ config }, 'decryptConfig()');
  const decryptedConfig = { ...config };
  const { privateKey } = getAdminConfig();
  for (const [key, val] of Object.entries(config)) {
    if (key === 'encrypted' && is.object(val)) {
      logger.debug({ config: val }, 'Found encrypted config');
      if (privateKey) {
        for (const [eKey, eVal] of Object.entries(val)) {
          try {
            let decryptedStr: string;
            try {
              logger.debug('Trying default padding for ' + eKey);
              decryptedStr = crypto
                .privateDecrypt(privateKey, Buffer.from(eVal, 'base64'))
                .toString();
              logger.debug('Decrypted config using default padding');
            } catch (err) {
              logger.debug('Trying RSA_PKCS1_PADDING for ' + eKey);
              decryptedStr = crypto
                .privateDecrypt(
                  {
                    key: privateKey,
                    padding: crypto.constants.RSA_PKCS1_PADDING,
                  },
                  Buffer.from(eVal, 'base64')
                )
                .toString();
              // let it throw if the above fails
            }
            // istanbul ignore if
            if (!decryptedStr.length) {
              throw new Error('empty string');
            }
            logger.debug(`Decrypted ${eKey}`);
            if (eKey === 'npmToken') {
              const token = decryptedStr.replace(/\n$/, '');
              add(token);
              logger.debug(
                { decryptedToken: maskToken(token) },
                'Migrating npmToken to npmrc'
              );
              if (is.string(decryptedConfig.npmrc)) {
                /* eslint-disable no-template-curly-in-string */
                if (decryptedConfig.npmrc.includes('${NPM_TOKEN}')) {
                  logger.debug('Replacing ${NPM_TOKEN} with decrypted token');
                  decryptedConfig.npmrc = decryptedConfig.npmrc.replace(
                    /\${NPM_TOKEN}/g,
                    token
                  );
                } else {
                  logger.debug(
                    'Appending _authToken= to end of existing npmrc'
                  );
                  decryptedConfig.npmrc = decryptedConfig.npmrc.replace(
                    /\n?$/,
                    `\n_authToken=${token}\n`
                  );
                }
                /* eslint-enable no-template-curly-in-string */
              } else {
                logger.debug('Adding npmrc to config');
                decryptedConfig.npmrc = `//registry.npmjs.org/:_authToken=${token}\n`;
              }
            } else {
              decryptedConfig[eKey] = decryptedStr;
              add(decryptedStr);
            }
          } catch (err) {
            const error = new Error('config-validation');
            error.validationError = `Failed to decrypt field ${eKey}. Please re-encrypt and try again.`;
            throw error;
          }
        }
      } else {
        logger.error('Found encrypted data but no privateKey');
      }
      delete decryptedConfig.encrypted;
    } else if (is.array(val)) {
      decryptedConfig[key] = [];
      val.forEach((item) => {
        if (is.object(item) && !is.array(item)) {
          (decryptedConfig[key] as RenovateConfig[]).push(
            decryptConfig(item as RenovateConfig)
          );
        } else {
          (decryptedConfig[key] as unknown[]).push(item);
        }
      });
    } else if (is.object(val) && key !== 'content') {
      decryptedConfig[key] = decryptConfig(val as RenovateConfig);
    }
  }
  delete decryptedConfig.encrypted;
  logger.trace({ config: decryptedConfig }, 'decryptedConfig');
  return decryptedConfig;
}
