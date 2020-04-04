import { logger } from '../../logger';
import { Preset } from './common';
import { Http, HttpOptions } from '../../util/http';
import { PLATFORM_FAILURE } from '../../constants/error-messages';

const id = 'github';
const http = new Http(id);

async function fetchJSONFile(repo: string, fileName: string): Promise<Preset> {
  const url = `https://api.github.com/repos/${repo}/contents/${fileName}`;
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
      { statusCode: err.statusCodef },
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

export async function getPreset(
  pkgName: string,
  presetName = 'default'
): Promise<Preset> {
  if (presetName === 'default') {
    try {
      const defaultJson = await fetchJSONFile(pkgName, 'default.json');
      return defaultJson;
    } catch (err) {
      if (err.message === PLATFORM_FAILURE) {
        throw err;
      }
      if (err.message === 'dep not found') {
        logger.debug('default.json preset not found - trying renovate.json');
        return fetchJSONFile(pkgName, 'renovate.json');
      }
      throw err;
    }
  }
  return fetchJSONFile(pkgName, `${presetName}.json`);
}
