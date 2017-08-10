module.exports = {
  massageConfig,
};

const stringToArray = ['description', 'schedule'];

// Returns a migrated config
function massageConfig(config) {
  const massagedConfig = { ...config };
  for (const key of Object.keys(config)) {
    const val = config[key];
    if (stringToArray.includes(key) && typeof val === 'string') {
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
