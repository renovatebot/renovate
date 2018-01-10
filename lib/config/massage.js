const deepcopy = require('deepcopy');
const options = require('./definitions').getOptions();

let allowedStrings;

module.exports = {
  massageConfig,
};

// Returns a massaged config
function massageConfig(config) {
  if (!allowedStrings) {
    allowedStrings = [];
    options.forEach(option => {
      if (option.allowString) {
        allowedStrings.push(option.name);
      }
    });
  }
  const massagedConfig = deepcopy(config);
  for (const [key, val] of Object.entries(config)) {
    if (allowedStrings.includes(key) && typeof val === 'string') {
      massagedConfig[key] = [val];
    } else if (key === 'npmToken' && val && val.length < 30) {
      massagedConfig.npmrc = `//registry.npmjs.org/:_authToken=${val}\n`;
      delete massagedConfig.npmToken;
    } else if (isObject(val)) {
      massagedConfig[key] = massageConfig(val);
    } else if (Array.isArray(val)) {
      massagedConfig[key] = [];
      val.forEach(item => {
        if (isObject(item)) {
          massagedConfig[key].push(massageConfig(item));
        } else {
          massagedConfig[key].push(item);
        }
      });
    }
  }
  return massagedConfig;
}

function isObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]';
}
