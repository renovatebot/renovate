import { resolvePackage } from '../../../datasource/npm/npmrc';
import { NpmResponse } from '../../../datasource/npm/types';
import { logger } from '../../../logger';
import { Http } from '../../../util/http';
import type { Preset, PresetConfig } from '../types';

const id = 'npm';

const http = new Http(id);

export async function getPreset({
  packageName,
  presetName = 'default',
}: PresetConfig): Promise<Preset> {
  let dep;
  try {
    const { headers, packageUrl } = resolvePackage(packageName);
    const body = (await http.getJson<NpmResponse>(packageUrl, { headers }))
      .body;
    dep = body.versions[body['dist-tags'].latest];
  } catch (err) {
    throw new Error('dep not found');
  }
  if (!dep['renovate-config']) {
    throw new Error('preset renovate-config not found');
  }
  const presetConfig = dep['renovate-config'][presetName];
  if (!presetConfig) {
    const presetNames = Object.keys(dep['renovate-config']);
    logger.debug(
      { presetNames, presetName },
      'Preset not found within renovate-config'
    );
    throw new Error('preset not found');
  }
  return presetConfig;
}
