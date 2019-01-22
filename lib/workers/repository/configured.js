module.exports = {
  checkIfConfigured,
};

function checkIfConfigured(config) {
  if (config.enabled === false) {
    throw new Error('disabled');
  }
  if (config.isFork && !config.includeForks) {
    throw new Error('fork');
  }
}
