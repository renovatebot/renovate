const deepIterator = require("deep-iterator").default; // eslint-disable-line
const options = require('./definitions').getOptions();

const optionNames = options.map(option => option.name);

module.exports = {
  validateConfig,
};

function validateConfig(config) {
  let errors = [];

  function isIgnored(key) {
    const ignoredNodes = ['api', 'depType'];
    return ignoredNodes.indexOf(key) !== -1;
  }

  function isAFunction(value) {
    const getType = {};
    return value && getType.toString.call(value) === '[object Function]';
  }

  function isUnknownOption(key) {
    return optionNames.indexOf(key) === -1;
  }

  function isObject(obj) {
    return Object.prototype.toString.call(obj) === '[object Object]';
  }

  for (const key of Object.keys(config)) {
    const val = config[key];
    if (
      !isIgnored(key) && // We need to ignore some reserved keys
      !isAFunction(val) // Ignore all functions
    ) {
      if (isUnknownOption(key)) {
        errors.push({
          depName: 'Configuration Error',
          message: `Invalid configuration option: \`${key}\``,
        });
      } else if (isObject(val)) {
        errors = errors.concat(module.exports.validateConfig(val));
      }
    }
  }
  return errors;
}
