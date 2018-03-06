const configParser = require('./index');
const massage = require('./massage');
const migration = require('./migration');
const npm = require('../datasource/npm');

module.exports = {
  resolveConfigPresets,
  replaceArgs,
  parsePreset,
  getPreset,
};

async function resolveConfigPresets(inputConfig, existingPresets = []) {
  logger.trace(
    { config: inputConfig, existingPresets },
    'resolveConfigPresets'
  );
  let config = {};
  // First, merge all the preset configs from left to right
  if (inputConfig.extends && inputConfig.extends.length) {
    if (existingPresets.length === 0) {
      logger.info('Found presets');
    }
    for (const preset of inputConfig.extends) {
      // istanbul ignore if
      if (existingPresets.indexOf(preset) !== -1) {
        logger.warn(`Already seen preset ${preset} in ${existingPresets}`);
      } else {
        logger.trace(`Resolving preset "${preset}"`);
        let fetchedPreset;
        try {
          fetchedPreset = await getPreset(preset);
        } catch (err) {
          // istanbul ignore else
          if (existingPresets.length === 0) {
            const error = new Error('config-validation');
            if (err.message === 'dep not found') {
              error.validationError = `Cannot find preset's package (${preset})`;
            } else if (err.message === 'preset renovate-config not found') {
              // istanbul ignore next
              error.validationError = `Preset package is missing a renovate-config entry (${preset})`;
            } else if (err.message === 'preset not found') {
              error.validationError = `Preset name not found within published preset config (${preset})`;
            } else {
              /* istanbul ignore next */ // eslint-disable-next-line
              if (err.message === 'registry-failure') {
                throw err;
              }
            }
            logger.info('Throwing preset error');
            throw error;
          } else {
            logger.warn({ preset }, `Cannot find nested preset`);
            fetchedPreset = {};
          }
        }
        const presetConfig = await resolveConfigPresets(
          fetchedPreset,
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
  for (const [key, val] of Object.entries(config)) {
    const ignoredKeys = ['content'];
    if (isObject(val) && ignoredKeys.indexOf(key) === -1) {
      // Resolve nested objects
      logger.trace(`Resolving object "${key}"`);
      config[key] = await resolveConfigPresets(val, existingPresets);
    } else if (Array.isArray(val)) {
      // Resolve nested objects inside arrays
      config[key] = [];
      for (const element of val) {
        if (isObject(element)) {
          config[key].push(
            await resolveConfigPresets(element, existingPresets)
          );
        } else {
          config[key].push(element);
        }
      }
    }
  }
  logger.trace({ config: inputConfig }, 'Input config');
  logger.trace({ config }, 'Resolved config');
  return config;
}

function replaceArgs(obj, argMapping) {
  if (typeof obj === 'string') {
    let returnStr = obj;
    for (const [arg, argVal] of Object.entries(argMapping)) {
      const re = new RegExp(`{{${arg}}}`, 'g');
      returnStr = returnStr.replace(re, argVal);
    }
    return returnStr;
  }
  if (isObject(obj)) {
    const returnObj = {};
    for (const [key, val] of Object.entries(obj)) {
      returnObj[key] = replaceArgs(val, argMapping);
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
    [, packageName] = str.match(/(@.*?)(:|$)/);
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
    [, packageName] = str.match(/(.*?)(:|$)/);
    presetName = str.slice(packageName.length + 1);
    if (packageName.indexOf('renovate-config-') !== 0) {
      packageName = `renovate-config-${packageName}`;
    }
    if (presetName === '') {
      presetName = 'default';
    }
  }
  return { packageName, presetName, params };
}

async function getPreset(preset) {
  logger.trace(`getPreset(${preset})`);
  const { packageName, presetName, params } = parsePreset(preset);
  let presetConfig;
  const dep = await npm.getDependency(packageName);
  if (!dep) {
    throw Error('dep not found');
  }
  if (!dep['renovate-config']) {
    throw Error('preset renovate-config not found');
  }
  presetConfig = dep['renovate-config'][presetName];
  if (!presetConfig) {
    throw Error('preset not found');
  }
  logger.debug(`Found preset ${preset}`);
  logger.trace({ presetConfig });
  if (params) {
    const argMapping = {};
    for (const [index, value] of params.entries()) {
      argMapping[`arg${index}`] = value;
    }
    presetConfig = replaceArgs(presetConfig, argMapping);
  }
  logger.trace({ presetConfig }, `Applied params to preset ${preset}`);
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
    'unstablePattern',
  ];
  if (presetKeys.every(key => packageListKeys.includes(key))) {
    delete presetConfig.description;
  }
  const { migratedConfig } = migration.migrateConfig(presetConfig);
  return massage.massageConfig(migratedConfig);
}

function isObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]';
}
