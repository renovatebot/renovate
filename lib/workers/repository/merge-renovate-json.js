module.exports = mergeRenovateJson;

// Check for config in `renovate.json`
async function mergeRenovateJson(config) {
  const renovateJson = await config.api.getFileJson('renovate.json');
  if (!renovateJson) {
    config.logger.debug('No renovate.json found');
    return config;
  }
  config.logger.debug({ config: renovateJson }, 'renovate.json config');
  return Object.assign({}, config, renovateJson, { repoConfigured: true });
}
