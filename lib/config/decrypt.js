const crypto = require('crypto');

module.exports = {
  decryptConfig,
};

function decryptConfig(config, logger, privateKey) {
  logger.trace({ config }, 'decryptConfig');
  const decryptedConfig = { ...config };
  for (const key of Object.keys(config)) {
    const val = config[key];
    if (key === 'encrypted' && isObject(val)) {
      logger.debug({ config: val }, 'Found encrypted config');
      if (privateKey) {
        for (const encryptedKey of Object.keys(val)) {
          try {
            const decryptedStr = crypto
              .privateDecrypt(
                privateKey,
                Buffer.from(val[encryptedKey], 'base64')
              )
              .toString();
            logger.info(`Decrypted ${encryptedKey}`);
            if (encryptedKey === 'npmToken') {
              logger.info('Migrating npmToken to npmrc');
              decryptedConfig.npmrc = `//registry.npmjs.org/:_authToken=${
                decryptedStr
              }\n`;
            } else {
              decryptedConfig[encryptedKey] = decryptedStr;
            }
          } catch (err) {
            logger.warn({ err }, `Error decrypting ${encryptedKey}`);
          }
        }
      } else {
        logger.error('Found encrypted data but no privateKey');
      }
      delete decryptedConfig.encrypted;
    } else if (isObject(val) && key !== 'content' && key !== 'logger') {
      decryptedConfig[key] = decryptConfig(val, logger, privateKey);
    } else if (Array.isArray(val)) {
      decryptedConfig[key] = [];
      val.forEach(item => {
        if (isObject(item)) {
          decryptedConfig[key].push(decryptConfig(item, logger, privateKey));
        } else {
          decryptedConfig[key].push(item);
        }
      });
    }
  }
  delete decryptedConfig.encrypted;
  logger.trace({ config: decryptedConfig }, 'decryptedConfig');
  return decryptedConfig;
}

function isObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]';
}
