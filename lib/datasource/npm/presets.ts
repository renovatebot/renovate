import { logger } from '../../logger';
import { getDependency } from './get';
import { Preset } from '../common';

export async function getPreset(
  pkgName: string,
  presetName = 'default'
): Promise<Preset> {
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
