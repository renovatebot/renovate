module.exports = {
  checkIfConfigured,
};

function checkIfConfigured(config) {
  if (config.enabled === false) {
    throw new Error('disabled');
  }
  if (config.isFork && !config.renovateJsonPresent) {
    throw new Error('fork');
  }
}
