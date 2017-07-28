const options = require('./definitions').getOptions();

const optionTypes = {};
options.forEach(option => {
  optionTypes[option.name] = [option.type];
});

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

  function isObject(obj) {
    return Object.prototype.toString.call(obj) === '[object Object]';
  }

  for (const key of Object.keys(config)) {
    const val = config[key];
    if (
      !isIgnored(key) && // We need to ignore some reserved keys
      !isAFunction(val) // Ignore all functions
    ) {
      if (!optionTypes[key]) {
        errors.push({
          depName: 'Configuration Error',
          message: `Invalid configuration option: \`${key}\``,
        });
      } else {
        const type = optionTypes[key].toString();
        if (type === 'boolean') {
          if (val !== true && val !== false) {
            errors.push({
              depName: 'Configuration Error',
              message: `Configuration option \`${key}\` should be boolean`,
            });
          }
        } else if (type === 'list') {
          if (!Array.isArray(val)) {
            errors.push({
              depName: 'Configuration Error',
              message: `Configuration option \`${key}\` should be a list (Array)`,
            });
          }
        } else if (type === 'string') {
          if (!(typeof val === 'string' || val instanceof String)) {
            errors.push({
              depName: 'Configuration Error',
              message: `Configuration option \`${key}\` should be a string`,
            });
          }
        } else if (type === 'integer') {
          if (val !== parseInt(val, 10)) {
            errors.push({
              depName: 'Configuration Error',
              message: `Configuration option \`${key}\` should be an integer`,
            });
          }
        } else if (type === 'json') {
          if (isObject(val)) {
            errors = errors.concat(module.exports.validateConfig(val));
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
  return errors;
}
