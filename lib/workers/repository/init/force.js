const { mergeChildConfig } = require('../../../config');

function applyForceConfig(input) {
  let config = { ...input };
  if (config.force && Object.keys(config.force).length) {
    logger.debug('Applying forced config');
    config = mergeChildConfig(config, config.force);
    config.packageRules = config.packageRules || [];
    config.packageRules.push({
      ...config.force,
      packagePatterns: ['.*'],
    });
    delete config.force;
  }
  return config;
}

module.exports = {
  applyForceConfig,
};
