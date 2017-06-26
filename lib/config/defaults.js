const configDefinitions = require('./definitions');

module.exports = {
  getDefault,
  getConfig,
  getOnboardingConfig,
};

const defaultValues = {
  boolean: true,
  list: [],
  string: null,
};

function getDefault(option) {
  return option.default === undefined
    ? defaultValues[option.type]
    : option.default;
}

function getConfig() {
  const options = configDefinitions.getOptions();
  const config = {};
  options.forEach(option => {
    config[option.name] = getDefault(option);
  });
  return config;
}

function getOnboardingConfig() {
  const options = configDefinitions.getOptions();
  const config = {};
  options.forEach(option => {
    if (option.level !== 'global' && option.onboarding !== false) {
      config[option.name] = getDefault(option);
    }
  });
  return config;
}
