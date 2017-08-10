const presetDefaults = require('./presetDefaults');
const presetGroups = require('./presetGroups');
const configParser = require('./index');

module.exports = {
  resolvePresets,
};

function resolvePresets(
  inputConfig,
  logger = inputConfig.logger,
  existing = []
) {
  logger.trace({ config: inputConfig, existing }, 'resolvePresets');
  // First, merge all the preset configs
  let config = {};
  if (inputConfig.extends) {
    logger.debug('Found presets');
    for (const preset of inputConfig.extends) {
      logger.debug(`Processing preset ${preset}`);
      // istanbul ignore if
      if (existing.indexOf(preset) !== -1) {
        logger.warn(`Already seen preset ${preset} in ${existing}`);
      } else {
        logger.debug(`Resolving preset "${preset}"`);
        config = configParser.mergeChildConfig(
          config,
          resolvePresets(
            getPreset(preset, logger),
            logger,
            existing.concat([preset])
          )
        );
      }
    }
  }
  logger.debug(`Post-preset resolve config: ${JSON.stringify(config)}`);
  // Now assign "regular" config on top
  config = configParser.mergeChildConfig(config, inputConfig);
  logger.debug(`Post-merge resolve config: ${JSON.stringify(config)}`);
  delete config.extends;
  for (const key of Object.keys(config)) {
    const val = config[key];
    if (isObject(val)) {
      // Resolve nested objects
      logger.debug(`Resolving object "${key}"`);
      config[key] = resolvePresets(val, logger, existing);
    } else if (Array.isArray(val)) {
      // Resolve nested objects inside arrays
      config[key] = val.map(element => {
        if (isObject(element)) {
          return resolvePresets(element, logger, existing);
        }
        return element;
      });
    }
  }
  return config;
}

function getPreset(preset, logger) {
  logger.debug(`getPreset(${preset})`);
  const presetConfig = presetDefaults[preset] || presetGroups[preset];
  if (!presetConfig) {
    logger.warn(`Cannot find preset ${preset}`);
    return {};
  }
  logger.debug(`returning ${JSON.stringify(presetConfig)}`);
  return presetConfig;
}

function isObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]';
}
