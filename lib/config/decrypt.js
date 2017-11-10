const crypto = require('crypto');

module.exports = {
  decryptConfig,
};

function decryptConfig(config, privateKey) {
  logger.trace({ config }, 'decryptConfig');
  const decryptedConfig = { ...config };
  for (const [key, val] of Object.entries(config)) {
    if (key === 'encrypted' && isObject(val)) {
      logger.debug({ config: val }, 'Found encrypted config');
      if (privateKey) {
        for (const [eKey, eVal] of Object.entries(val)) {
          try {
            const decryptedStr = crypto
              .privateDecrypt(privateKey, Buffer.from(eVal, 'base64'))
              .toString();
            logger.info(`Decrypted ${eKey}`);
            if (eKey === 'npmToken') {
              logger.info('Migrating npmToken to npmrc');
              decryptedConfig.npmrc = `//registry.npmjs.org/:_authToken=${decryptedStr}\n`;
            } else {
              decryptedConfig[eKey] = decryptedStr;
            }
          } catch (err) {
            logger.warn({ err }, `Error decrypting ${eKey}`);
          }
        }
      } else {
        logger.error('Found encrypted data but no privateKey');
      }
      delete decryptedConfig.encrypted;
    } else if (isObject(val) && key !== 'content') {
      decryptedConfig[key] = decryptConfig(val, privateKey);
    } else if (Array.isArray(val)) {
      decryptedConfig[key] = [];
      val.forEach(item => {
        if (isObject(item)) {
          decryptedConfig[key].push(decryptConfig(item, privateKey));
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
