const presetDefaults = require('./default');
const presetPackages = require('./packages');
const configParser = require('../index');
const massage = require('../massage');

module.exports = {
  resolveConfigPresets,
  replaceArgs,
  parsePreset,
  getPreset,
};

function resolveConfigPresets(
  inputConfig,
  logger = inputConfig.logger,
  existingPresets = []
) {
  logger.trace(
    { config: inputConfig, existingPresets },
    'resolveConfigPresets'
  );
  let config = {};
  // First, merge all the preset configs from left to right
  if (inputConfig.extends) {
    logger.debug('Found presets');
    for (const preset of inputConfig.extends) {
      // istanbul ignore if
      if (existingPresets.indexOf(preset) !== -1) {
        logger.warn(`Already seen preset ${preset} in ${existingPresets}`);
      } else {
        logger.debug(`Resolving preset "${preset}"`);
        const presetConfig = resolveConfigPresets(
          getPreset(preset, logger),
          logger,
          existingPresets.concat([preset])
        );
        config = configParser.mergeChildConfig(config, presetConfig);
      }
    }
  }
  logger.trace({ config }, `Post-preset resolve config`);
  // Now assign "regular" config on top
  config = configParser.mergeChildConfig(config, inputConfig);
  delete config.extends;
  logger.trace({ config }, `Post-merge resolve config`);
  for (const key of Object.keys(config)) {
    const val = config[key];
    if (isObject(val)) {
      // Resolve nested objects
      logger.trace(`Resolving object "${key}"`);
      config[key] = resolveConfigPresets(val, logger, existingPresets);
    } else if (Array.isArray(val)) {
      // Resolve nested objects inside arrays
      config[key] = val.map(element => {
        if (isObject(element)) {
          return resolveConfigPresets(element, logger, existingPresets);
        }
        return element;
      });
    }
  }
  logger.debug({ config: inputConfig }, 'Input config');
  logger.debug({ config }, 'Resolved config');
  return config;
}

function replaceArgs(obj, argMapping) {
  if (typeof obj === 'string') {
    let returnStr = obj;
    for (const arg of Object.keys(argMapping)) {
      returnStr = returnStr.replace(`{{${arg}}}`, argMapping[arg]);
    }
    return returnStr;
  }
  if (isObject(obj)) {
    const returnObj = { ...obj };
    for (const key of Object.keys(obj)) {
      returnObj[key] = replaceArgs(obj[key], argMapping);
    }
    return returnObj;
  }
  if (Array.isArray(obj)) {
    const returnArray = [];
    for (const item of obj) {
      returnArray.push(replaceArgs(item, argMapping));
    }
    return returnArray;
  }
  return obj;
}

function parsePreset(input) {
  let str = input;
  let packageName;
  let presetName;
  let params;
  if (str.includes('(')) {
    params = str
      .slice(str.indexOf('(') + 1, -1)
      .split(',')
      .map(elem => elem.trim());
    str = str.slice(0, str.indexOf('('));
  }
  if (str[0] === ':') {
    // default namespace
    packageName = 'renovate-config-default';
    presetName = str.slice(1);
  } else if (str[0] === '@') {
    // scoped namespace
    packageName = str.match(/(@.*?)(:|$)/)[1];
    str = str.slice(packageName.length);
    if (!packageName.includes('/')) {
      packageName += '/renovate-config';
    }
    if (str === '') {
      presetName = 'default';
    } else {
      presetName = str.slice(1);
    }
  } else {
    // non-scoped namespace
    packageName = str.match(/(.*?)(:|$)/)[1];
    presetName = str.slice(packageName.length);
    if (packageName.indexOf('renovate-config-') !== 0) {
      packageName = `renovate-config-${packageName}`;
    }
    if (presetName === '') {
      presetName = 'default';
    }
  }
  return { packageName, presetName, params };
}

function getPreset(preset, logger) {
  logger.debug(`getPreset(${preset})`);
  let presetConfig;
  if (preset.indexOf('(') !== -1) {
    const presetName = preset.slice(0, preset.indexOf('('));
    const params = preset
      .slice(presetName.length + 1, -1)
      .replace(/, /g, ',')
      .split(',');
    presetConfig = presetDefaults[presetName];
    const argMapping = {};
    for (const [index, value] of params.entries()) {
      argMapping[`arg${index}`] = value;
    }
    presetConfig = replaceArgs(presetConfig, argMapping);
  } else if (preset.indexOf('packages:') === 0) {
    const presetName = preset.substring('packages:'.length);
    presetConfig = presetPackages[presetName];
  } else {
    presetConfig = presetDefaults[preset];
  }
  if (!presetConfig) {
    logger.warn(`Cannot find preset ${preset}`);
    return {};
  }
  logger.debug({ presetConfig }, `Found preset ${preset}`);
  const presetKeys = Object.keys(presetConfig);
  if (
    presetKeys.length === 2 &&
    presetKeys.includes('description') &&
    presetKeys.includes('extends')
  ) {
    // preset is just a collection of other presets
    delete presetConfig.description;
  }
  const packageListKeys = [
    'description',
    'packageNames',
    'excludePackageNames',
    'packagePatterns',
    'excludePackagePatterns',
  ];
  if (presetKeys.every(key => packageListKeys.includes(key))) {
    delete presetConfig.description;
  }
  return massage.massageConfig(presetConfig);
}

function isObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]';
}
