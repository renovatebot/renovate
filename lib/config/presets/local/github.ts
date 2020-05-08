import { PLATFORM_FAILURE } from '../../../constants/error-messages';
import { PLATFORM_TYPE_GITHUB } from '../../../constants/platforms';
import { logger } from '../../../logger';
import { Http, HttpOptions } from '../../../util/http';
import { ensureTrailingSlash } from '../../../util/url';
import { Preset } from '../common';

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
    if (err.message === PLATFORM_FAILURE) {
      throw err;
    }
    logger.debug(
      { statusCode: err.statusCode },
      `Failed to retrieve ${fileName} from repo`
    );
    throw new Error('dep not found');
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
  endpoint = 'https://api.github.com/'
): Promise<Preset> {
  // eslint-disable-next-line no-param-reassign
  endpoint = ensureTrailingSlash(endpoint);
  const [fileName, presetName, subPresetName] = filePreset.split('/');
  let jsonContent;
  if (fileName === 'default') {
    try {
      jsonContent = await fetchJSONFile(pkgName, 'default.json', endpoint);
    } catch (err) {
      if (err.message !== 'dep not found') {
        throw err;
      }
      logger.debug('default.json preset not found - trying renovate.json');
      jsonContent = await fetchJSONFile(pkgName, 'renovate.json', endpoint);
    }
  } else {
    jsonContent = await fetchJSONFile(pkgName, `${fileName}.json`, endpoint);
  }
  if (presetName) {
    if (subPresetName) {
      return jsonContent[presetName]
        ? jsonContent[presetName][subPresetName]
        : undefined;
    }
    return jsonContent[presetName];
  }
  return jsonContent;
}
