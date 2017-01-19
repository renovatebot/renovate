const configMaster = require('./master');

module.exports = {
  getConfig,
};

function getConfig() {
  const options = configMaster.getOptions();

  const config = {};

  const defaultValues = {
    boolean: true,
    list: [],
    string: null,
  };
  options.forEach((option) => {
    config[option.name] = option.default || defaultValues[option.type];
  });
  return config;
}
