import { logger } from '../../logger';
import { parseJson } from '../../util/common';
import { regEx } from '../../util/regex';
import { ensureTrailingSlash } from '../../util/url';
import type { FetchPresetConfig, Preset } from './types';

export const PRESET_DEP_NOT_FOUND = 'dep not found';
export const PRESET_INVALID = 'invalid preset';
export const PRESET_INVALID_JSON = 'invalid preset JSON';
export const PRESET_NOT_FOUND = 'preset not found';
export const PRESET_PROHIBITED_SUBPRESET = 'prohibited sub-preset';
export const PRESET_RENOVATE_CONFIG_NOT_FOUND =
  'preset renovate-config not found';

export async function fetchPreset({
  repo,
  filePreset,
  presetPath,
  endpoint: _endpoint,
  tag,
  fetch,
}: FetchPresetConfig): Promise<Preset | undefined> {
  // TODO: fix me, can be undefiend #22198
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const endpoint = ensureTrailingSlash(_endpoint!);
  const [fileName, presetName, subPresetName] = filePreset.split('/');
  const pathPrefix = presetPath ? `${presetPath}/` : '';
  const buildFilePath = (name: string): string => `${pathPrefix}${name}`;
  let jsonContent: any;
  if (fileName === 'default') {
    try {
      jsonContent = await fetch(
        repo,
        buildFilePath('default.json'),
        endpoint,
        tag,
      );
    } catch (err) {
      if (err.message !== PRESET_DEP_NOT_FOUND) {
        throw err;
      }
      jsonContent = await fetch(
        repo,
        buildFilePath('renovate.json'),
        endpoint,
        tag,
      );
      logger.warn(
        {
          repo,
          filePreset,
          presetPath,
          endpoint,
          tag,
        },
        'Fallback to renovate.json file as a preset is deprecated, please use a default.json file instead.',
      );
    }
  } else {
    jsonContent = await fetch(
      repo,
      buildFilePath(
        regEx(/\.json5?$/).test(fileName) ? fileName : `${fileName}.json`,
      ),
      endpoint,
      tag,
    );
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

export function parsePreset(content: string, fileName: string): Preset {
  try {
    return parseJson(content, fileName) as Preset;
  } catch (err) {
    throw new Error(PRESET_INVALID_JSON);
  }
}
