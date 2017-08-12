const presetDefaults = require('./presetDefaults');
const presetGroups = require('./presetGroups');
const configParser = require('./index');
const massage = require('./massage');

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
  logger.trace({ config }, `Post-preset resolve config`);
  // Now assign "regular" config on top
  config = configParser.mergeChildConfig(config, inputConfig);
  if (existing.length === 0) {
    logger.debug({ config }, 'Post-merger resolve config');
  }
  logger.trace({ config }, `Post-merge resolve config`);
  delete config.extends;
  if (inputConfig.useParentDesc) {
    config.description = inputConfig.description;
    delete config.useParentDesc;
  }
  for (const key of Object.keys(config)) {
    const val = config[key];
    if (isObject(val)) {
      // Resolve nested objects
      logger.trace(`Resolving object "${key}"`);
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
  const presetKeys = Object.keys(presetConfig);
  if (
    presetKeys.length === 2 &&
    presetKeys.includes('description') &&
    presetKeys.includes('extends')
  ) {
    delete presetConfig.description;
  } else {
    presetConfig.useParentDesc = true;
  }
  return massage.massageConfig(presetConfig);
}

function isObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]';
}
