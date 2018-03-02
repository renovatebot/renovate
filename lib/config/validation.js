const semver = require('semver');
const options = require('./definitions').getOptions();
const { hasValidSchedule } = require('../workers/branch/schedule');

let optionTypes;

module.exports = {
  validateConfig,
};

function validateConfig(config) {
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
      } else if (key === 'allowedVersions' && val !== null) {
        if (!semver.validRange(val)) {
          errors.push({
            depName: 'Configuration Error',
            message: `Invalid semver range for allowedVersions: \`${val}\``,
          });
        }
      } else if (val != null) {
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
        } else if (type === 'list') {
          if (!Array.isArray(val)) {
            errors.push({
              depName: 'Configuration Error',
              message: `Configuration option \`${key}\` should be a list (Array)`,
            });
          } else {
            // eslint-disable-next-line no-loop-func
            val.forEach(subval => {
              if (isObject(subval)) {
                const subValidation = module.exports.validateConfig(subval);
                warnings = warnings.concat(subValidation.warnings);
                errors = errors.concat(subValidation.errors);
              }
            });
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
            const subValidation = module.exports.validateConfig(val);
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
