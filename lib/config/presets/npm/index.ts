import { logger } from '../../../logger';
import {
  resolvePackageUrl,
  resolveRegistryUrl,
} from '../../../modules/datasource/npm/npmrc';
import { NpmResponse } from '../../../modules/datasource/npm/schema';
import { Http } from '../../../util/http';
import type { Preset, PresetConfig } from '../types';
import {
  PRESET_DEP_NOT_FOUND,
  PRESET_NOT_FOUND,
  PRESET_RENOVATE_CONFIG_NOT_FOUND,
} from '../util';

const id = 'npm';

const http = new Http(id);

export async function getPreset({
  repo: pkg,
  presetName = 'default',
}: PresetConfig): Promise<Preset | undefined> {
  const registryUrl = resolveRegistryUrl(pkg);

  logger.once.warn(
    { registryUrl, pkg },
    'Using npm packages for Renovate presets is now deprecated. Please migrate to repository-based presets instead.',
  );

  const packageUrl = resolvePackageUrl(registryUrl, pkg);
  const { val: dep, err } = await http
    .getJsonSafe(packageUrl, NpmResponse)
    .unwrap();

  if (err) {
    throw new Error(PRESET_DEP_NOT_FOUND);
  }

  const presets = dep?.latestVersion?.npmHostedPresets;
  if (!presets) {
    throw new Error(PRESET_RENOVATE_CONFIG_NOT_FOUND);
  }

  const presetConfig = presets[presetName];
  if (!presetConfig) {
    const presetNames = Object.keys(presets);
    logger.debug(
      { presetNames, presetName },
      'Preset not found within renovate-config',
    );
    throw new Error(PRESET_NOT_FOUND);
  }

  return presetConfig;
}
