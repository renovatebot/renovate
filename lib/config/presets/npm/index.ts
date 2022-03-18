import { logger } from '../../../logger';
import {
  resolvePackageUrl,
  resolveRegistryUrl,
} from '../../../modules/datasource/npm/npmrc';
import type { NpmResponse } from '../../../modules/datasource/npm/types';
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
}: PresetConfig): Promise<Preset> {
  let dep;
  try {
    const registryUrl = resolveRegistryUrl(pkg);
    const packageUrl = resolvePackageUrl(registryUrl, pkg);
    // istanbul ignore if
    if (!packageUrl.startsWith('https://registry.npmjs.org/')) {
      logger.warn(
        'npm presets from non-default registries are now deprecated. Please migrate to repository-based presets instead.'
      );
    }
    const body = (await http.getJson<NpmResponse>(packageUrl)).body;
    dep = body.versions[body['dist-tags'].latest];
  } catch (err) {
    throw new Error(PRESET_DEP_NOT_FOUND);
  }
  if (!dep['renovate-config']) {
    throw new Error(PRESET_RENOVATE_CONFIG_NOT_FOUND);
  }
  const presetConfig = dep['renovate-config'][presetName];
  if (!presetConfig) {
    const presetNames = Object.keys(dep['renovate-config']);
    logger.debug(
      { presetNames, presetName },
      'Preset not found within renovate-config'
    );
    throw new Error(PRESET_NOT_FOUND);
  }
  return presetConfig;
}
