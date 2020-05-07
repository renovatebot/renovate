import { PLATFORM_FAILURE } from '../../constants/error-messages';
import { logger } from '../../logger';
import { api } from '../../platform/gitlab/gl-got-wrapper';
import { ensureTrailingSlash } from '../../util/url';
import { Preset } from './common';

const { get: glGot } = api;

export async function getDefaultBranchName(
  urlEncodedPkgName: string,
  endpoint: string
): Promise<string> {
  const branchesUrl = `${endpoint}projects/${urlEncodedPkgName}/repository/branches`;
  type GlBranch = {
    default: boolean;
    name: string;
  }[];

  const res = await glGot<GlBranch>(branchesUrl);
  const branches = res.body;
  let defautlBranchName = 'master';
  for (const branch of branches) {
    if (branch.default) {
      defautlBranchName = branch.name;
      break;
    }
  }

  return defautlBranchName;
}

export async function fetchJSONFile(
  repo: string,
  fileName: string,
  endpoint: string
): Promise<Preset> {
  const urlEncodedPkgName = encodeURIComponent(repo);
  const defaultBranchName = await getDefaultBranchName(
    urlEncodedPkgName,
    endpoint
  );
  const url = `${endpoint}projects/${urlEncodedPkgName}/repository/files/${fileName}?ref=${defaultBranchName}`;
  let res: { body: { content: string } };
  try {
    res = await glGot(url);
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
  endpoint = 'https://gitlab.com/api/v4/'
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

export async function getPreset(
  pkgName: string,
  presetName = 'default'
): Promise<Preset> {
  return getPresetFromEndpoint(pkgName, presetName);
}
