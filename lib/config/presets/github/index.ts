import { PLATFORM_FAILURE } from '../../../constants/error-messages';
import { PLATFORM_TYPE_GITHUB } from '../../../constants/platforms';
import { logger } from '../../../logger';
import { Http, HttpOptions } from '../../../util/http';
import { Preset, PresetConfig } from '../common';
import { PRESET_DEP_NOT_FOUND, fetchPreset } from '../util';

export const Endpoint = 'https://api.github.com/';

const http = new Http(PLATFORM_TYPE_GITHUB);

export async function fetchJSONFile(
  repo: string,
  fileName: string,
  endpoint: string
): Promise<Preset> {
  const url = `${endpoint}repos/${repo}/contents/${fileName}`;
  const opts: HttpOptions = {
    headers: {
      accept: global.appMode
        ? 'application/vnd.github.machine-man-preview+json'
        : 'application/vnd.github.v3+json',
    },
  };
  let res: { body: { content: string } };
  try {
    res = await http.getJson(url, opts);
  } catch (err) {
    // istanbul ignore if: not testable with nock
    if (err.message === PLATFORM_FAILURE) {
      throw err;
    }
    logger.debug(
      { statusCode: err.statusCode },
      `Failed to retrieve ${fileName} from repo`
    );
    throw new Error(PRESET_DEP_NOT_FOUND);
  }
  try {
    const content = Buffer.from(res.body.content, 'base64').toString();
    const parsed = JSON.parse(content);
    return parsed;
  } catch (err) {
    throw new Error('invalid preset JSON');
  }
}

export async function getPresetFromEndpoint(
  pkgName: string,
  filePreset: string,
  endpoint = Endpoint
): Promise<Preset> {
  return fetchPreset({
    pkgName,
    filePreset,
    endpoint,
    fetch: fetchJSONFile,
  });
}

export function getPreset({
  packageName: pkgName,
  presetName = 'default',
}: PresetConfig): Promise<Preset> {
  return getPresetFromEndpoint(pkgName, presetName, Endpoint);
}
