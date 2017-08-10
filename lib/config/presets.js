const presetDefaults = require('./presetDefaults');
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
  if (inputConfig.presets) {
    for (const preset of inputConfig.presets) {
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
  // Now assign "regular" config on top
  config = configParser.mergeChildConfig(config, inputConfig);
  delete config.presets;
  for (const key of Object.keys(config)) {
    if (isObject(config[key])) {
      logger.debug(`Resolving object "${key}"`);
      config[key] = resolvePresets(config[key], logger, existing);
    }
  }
  return config;
}

function getPreset(preset, logger) {
  const presetConfig = presetDefaults[preset];
  if (!presetConfig) {
    logger.warn(`Cannot find preset ${preset}`);
    return {};
  }
  return presetConfig;
}

function isObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]';
}
