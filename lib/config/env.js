const configDefinitions = require('./definitions');

module.exports = {
  getEnvName,
  getConfig,
};

function getEnvName(option) {
  if (option.env === false) {
    return '';
  }
  if (option.env) {
    return option.env;
  }
  const nameWithUnderscores = option.name.replace(/([A-Z])/g, '_$1');
  return `RENOVATE_${nameWithUnderscores.toUpperCase()}`;
}

function getConfig(env) {
  const options = configDefinitions.getOptions();

  const config = {};

  const coersions = {
    boolean: val => val === 'true',
    list: val => val.split(',').map(el => el.trim()),
    string: val => val,
    json: val => JSON.parse(val),
  };

  options.forEach(option => {
    if (option.env !== false) {
      const envName = getEnvName(option);
      if (env[envName]) {
        const coerce = coersions[option.type];
        config[option.name] = coerce(env[envName]);
      }
    }
  });

  return config;
}
