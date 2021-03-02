import { logger } from '../../logger';
import { ensureTrailingSlash } from '../../util/url';
import { Preset } from './types';

export const PRESET_DEP_NOT_FOUND = 'dep not found';
export const PRESET_NOT_FOUND = 'preset not found';

export type PresetFetcher = (
  repo: string,
  fileName: string,
  endpoint: string
) => Promise<Preset>;

export type FetchPresetConfig = {
  pkgName: string;
  filePreset: string;
  endpoint: string;
  fetch: PresetFetcher;
};

export async function fetchPreset({
  pkgName,
  filePreset,
  endpoint,
  fetch,
}: FetchPresetConfig): Promise<Preset | undefined> {
  // eslint-disable-next-line no-param-reassign
  endpoint = ensureTrailingSlash(endpoint);
  const [fileName, presetName, subPresetName] = filePreset.split('/');
  let jsonContent: any | undefined;
  if (fileName === 'default') {
    try {
      jsonContent = await fetch(pkgName, 'default.json', endpoint);
    } catch (err) {
      if (err.message !== PRESET_DEP_NOT_FOUND) {
        throw err;
      }
      logger.debug('default.json preset not found - trying renovate.json');
      jsonContent = await fetch(pkgName, 'renovate.json', endpoint);
    }
  } else {
    jsonContent = await fetch(pkgName, `${fileName}.json`, endpoint);
  }

  if (!jsonContent) {
    throw new Error(PRESET_DEP_NOT_FOUND);
  }
  if (presetName) {
    const preset = jsonContent[presetName];
    if (!preset) {
      throw new Error(PRESET_NOT_FOUND);
    }
    if (subPresetName) {
      const subPreset = preset[subPresetName];
      if (!subPreset) {
        throw new Error(PRESET_NOT_FOUND);
      }
      return subPreset;
    }
    return preset;
  }
  return jsonContent;
}
