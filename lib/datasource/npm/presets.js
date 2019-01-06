const { getDependency } = require('./get');

module.exports = {
  getPreset,
};

async function getPreset(pkgName, presetName = 'default') {
  const dep = await getDependency(pkgName);
  if (!dep) {
    throw new Error('dep not found');
  }
  if (!dep['renovate-config']) {
    throw new Error('preset renovate-config not found');
  }
  const presetConfig = dep['renovate-config'][presetName];
  if (!presetConfig) {
    throw new Error('preset not found');
  }
  return presetConfig;
}
