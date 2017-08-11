const options = require('./definitions').getOptions();

const allowedStrings = [];
options.forEach(option => {
  if (option.allowString) {
    allowedStrings.push(option.name);
  }
});

module.exports = {
  massageConfig,
};

// Returns a massaged config
function massageConfig(config) {
  const massagedConfig = { ...config };
  for (const key of Object.keys(config)) {
    const val = config[key];
    if (allowedStrings.includes(key) && typeof val === 'string') {
      massagedConfig[key] = [val];
    } else if (isObject(val)) {
      massagedConfig[key] = massageConfig(val);
    }
  }
  return massagedConfig;
}

function isObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]';
}
