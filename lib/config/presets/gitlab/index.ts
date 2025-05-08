import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import type { GitlabProject } from '../../../types/platform/gitlab';
import { GitlabHttp } from '../../../util/http/gitlab';
import type { HttpResponse } from '../../../util/http/types';
import { getFilenameFromPath } from '../../../util/url';
import type { Preset, PresetConfig } from '../types';
import { PRESET_DEP_NOT_FOUND, fetchPreset, parsePreset } from '../util';

const gitlabApi = new GitlabHttp();
export const Endpoint = 'https://gitlab.com/api/v4/';

async function getDefaultBranchName(
  urlEncodedPkgName: string,
  endpoint: string,
): Promise<string> {
  const res = await gitlabApi.getJsonUnchecked<GitlabProject>(
    `${endpoint}projects/${urlEncodedPkgName}`,
  );
  return res.body.default_branch ?? 'master'; // should never happen, but we keep this to ensure the current behavior
}

export async function fetchJSONFile(
  repo: string,
  fileName: string,
  endpoint: string,
  tag?: string,
): Promise<Preset> {
  let url = endpoint;
  let ref = '';
  let res: HttpResponse;
  try {
    const urlEncodedRepo = encodeURIComponent(repo);
    const urlEncodedPkgName = encodeURIComponent(fileName);
    if (is.nonEmptyString(tag)) {
      ref = `?ref=${tag}`;
    } else {
      const defaultBranchName = await getDefaultBranchName(
        urlEncodedRepo,
        endpoint,
      );
      ref = `?ref=${defaultBranchName}`;
    }
    url += `projects/${urlEncodedRepo}/repository/files/${urlEncodedPkgName}/raw${ref}`;
    logger.trace({ url }, `Preset URL`);
    res = await gitlabApi.getText(url);
  } catch (err) {
    if (err instanceof ExternalHostError) {
      throw err;
    }
    logger.debug(`Preset file ${fileName} not found in ${repo}`);
    throw new Error(PRESET_DEP_NOT_FOUND);
  }

  let cleanFileName = fileName;
  cleanFileName = cleanFileName.split('?')[0];

  if (cleanFileName.endsWith('/raw')) {
    cleanFileName = cleanFileName.substring(0, cleanFileName.length - 4);
  }
  if (cleanFileName.includes('%2F')) {
    const decodedPath = decodeURIComponent(cleanFileName);
    const lastSlashIndex = decodedPath.lastIndexOf('/');
    cleanFileName =
      lastSlashIndex >= 0
        ? decodedPath.substring(lastSlashIndex + 1)
        : decodedPath;
  } else if (cleanFileName.includes('/')) {
    cleanFileName = getFilenameFromPath(cleanFileName);
  }

  return parsePreset(res.body, cleanFileName);
}

export function getPresetFromEndpoint(
  repo: string,
  presetName: string,
  presetPath?: string,
  endpoint = Endpoint,
  tag?: string,
): Promise<Preset | undefined> {
  return fetchPreset({
    repo,
    filePreset: presetName,
    presetPath,
    endpoint,
    tag,
    fetch: fetchJSONFile,
  });
}

export function getPreset({
  repo,
  presetPath,
  presetName = 'default',
  tag = undefined,
}: PresetConfig): Promise<Preset | undefined> {
  return getPresetFromEndpoint(repo, presetName, presetPath, Endpoint, tag);
}
