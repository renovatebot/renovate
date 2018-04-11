const options = require('./definitions').getOptions();
const { isValidSemver } = require('../util/semver');
const { resolveConfigPresets } = require('./presets');
const {
  hasValidSchedule,
  hasValidTimezone,
} = require('../workers/branch/schedule');
const { initLogger } = require('../logger');

initLogger();

let optionTypes;
let inPackageRules = false;
let recursionConfigPath;

module.exports = {
  validateConfig,
};

async function validateConfig(config, isPreset = false, configPath = '') {
  if (!optionTypes) {
    optionTypes = {};
    options.forEach(option => {
      optionTypes[option.name] = option.type;
    });
  }
  let errors = [];
  let warnings = [];

  function isIgnored(key) {
    const ignoredNodes = [
      'prBanner',
      'depType',
      'npmToken',
      'packageFile',
      'forkToken',
      'repository',
    ];
    return ignoredNodes.indexOf(key) !== -1;
  }

  function isAFunction(value) {
    const getType = {};
    return value && getType.toString.call(value) === '[object Function]';
  }

  function isObject(obj) {
    return Object.prototype.toString.call(obj) === '[object Object]';
  }

  function isString(val) {
    return typeof val === 'string' || val instanceof String;
  }

  for (const [key, val] of Object.entries(config)) {
    if (
      !isIgnored(key) && // We need to ignore some reserved keys
      !isAFunction(val) // Ignore all functions
    ) {
      if (!optionTypes[key]) {
        errors.push({
          depName: 'Configuration Error',
          message: `Invalid configuration option: \`${key}\``,
        });
      } else if (key === 'schedule') {
        const [validSchedule, errorMessage] = hasValidSchedule(val);
        if (!validSchedule) {
          errors.push({
            depName: 'Configuration Error',
            message: `Invalid schedule: \`${errorMessage}\``,
          });
        }
      } else if (key === 'timezone' && val !== null) {
        const [validTimezone, errorMessage] = hasValidTimezone(val);
        if (!validTimezone) {
          errors.push({
            depName: 'Configuration Error',
            message: errorMessage,
          });
        }
      } else if (key === 'allowedVersions' && val !== null) {
        if (!isValidSemver(val)) {
          errors.push({
            depName: 'Configuration Error',
            message: `Invalid semver range for allowedVersions: \`${val}\``,
          });
        }
      } else if (val != null) {
        if (key === 'packageRules') {
          inPackageRules = true;
        }

        if (configPath.length === 0) {
          recursionConfigPath = configPath.concat(key);
        } else {
          recursionConfigPath = configPath.concat('.' + key);
        }

        const type = optionTypes[key];
        if (type === 'boolean') {
          if (val !== true && val !== false) {
            errors.push({
              depName: 'Configuration Error',
              message: `Configuration option \`${key}\` should be boolean. Found: ${JSON.stringify(
                val
              )} (${typeof val})`,
            });
          }
        } else if (type === 'list' && val) {
          if (!Array.isArray(val)) {
            errors.push({
              depName: 'Configuration Error',
              message: `Configuration option \`${key}\` should be a list (Array)`,
            });
          } else {
            for (const subval of val) {
              if (isObject(subval)) {
                const subValidation = await module.exports.validateConfig(
                  subval,
                  isPreset,
                  recursionConfigPath
                );
                warnings = warnings.concat(subValidation.warnings);
                errors = errors.concat(subValidation.errors);
              }
            }
            if (key === 'extends') {
              for (const subval of val) {
                if (isString(subval) && subval.match(/^:timezone(.+)$/)) {
                  const [, timezone] = subval.match(/^:timezone\((.+)\)$/);
                  const [validTimezone, errorMessage] = hasValidTimezone(
                    timezone
                  );
                  if (!validTimezone) {
                    errors.push({
                      depName: 'Configuration Error',
                      message: errorMessage,
                    });
                  }
                }
              }
            }

            const selectors = [
              'packageNames',
              'packagePatterns',
              'excludePackageNames',
              'excludePackagePatterns',
            ];

            if (key === 'packageRules') {
              for (const packageRule of val) {
                let hasSelector = false;
                if (isObject(packageRule)) {
                  const resolvedRule = await resolveConfigPresets(packageRule);
                  for (const pKey of Object.keys(resolvedRule)) {
                    if (selectors.includes(pKey)) {
                      hasSelector = true;
                    }
                  }
                  if (!hasSelector) {
                    const message = `Each packageRule must contain at least one selector (${selectors.join(
                      ', '
                    )}). If you wish for configuration to apply to all packages, it is not necessary to place it inside a packageRule at all.`;
                    errors.push({
                      depName: 'Configuration Error',
                      message,
                    });
                  }
                } else {
                  errors.push({
                    depName: 'Configuration Error',
                    message: 'packageRules must contain JSON objects',
                  });
                }
              }
              inPackageRules = false;
            }
            if (
              (key === 'packagePatterns' || key === 'excludePackagePatterns') &&
              !(val && val.length === 1 && val[0] === '*')
            ) {
              try {
                RegExp(val);
              } catch (e) {
                errors.push({
                  depName: 'Configuration Error',
                  message: `Invalid regExp for ${key}: \`${val}\``,
                });
              }
            }

            if (selectors.includes(key) && !inPackageRules) {
              if (!isPreset || configPath !== '') {
                errors.push({
                  depName: 'Configuration Error',
                  message: `packageRule selectors should only be in a packageRules array or on a top level of a preset (current location: /${configPath})`,
                });
              }
            }
          }
        } else if (type === 'string') {
          if (!isString(val)) {
            errors.push({
              depName: 'Configuration Error',
              message: `Configuration option \`${key}\` should be a string`,
            });
          }
        } else if (type === 'json') {
          if (isObject(val)) {
            const subValidation = await module.exports.validateConfig(
              val,
              isPreset,
              recursionConfigPath
            );
            warnings = warnings.concat(subValidation.warnings);
            errors = errors.concat(subValidation.errors);
          } else {
            errors.push({
              depName: 'Configuration Error',
              message: `Configuration option \`${key}\` should be a json object`,
            });
          }
        }
      }
    }
  }
  return { errors, warnings };
}
