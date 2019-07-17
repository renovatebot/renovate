import { logger } from '../../logger';

const { getDependency } = require('./get');

export { getPreset };

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
    const presetNames = Object.keys(dep['renovate-config']);
    logger.info(
      { presetNames, presetName },
      'Preset not found within renovate-config'
    );
    throw new Error('preset not found');
  }
  return presetConfig;
}
