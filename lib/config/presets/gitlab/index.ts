import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import type { Nullish } from '../../../types';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import type { GitlabProject } from '../../../types/platform/gitlab';
import { GitlabHttp } from '../../../util/http/gitlab';
import type { HttpResponse } from '../../../util/http/types';
import { regEx } from '../../../util/regex';
import { parseUrl } from '../../../util/url';
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
): Promise<Nullish<Preset>> {
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
    logger.debug(
      `Preset file ${fileName} not found in ${repo}: ${err.message}`,
    );
    throw new Error(PRESET_DEP_NOT_FOUND);
  }

  // Extract the actual filename without path or query parameters
  const cleanFileName = extractFilenameFromGitLabPath(fileName);

  return parsePreset(res.body, cleanFileName);
}

/**
 * Extracts the actual filename from a GitLab path, which could be:
 * - A simple filename: "renovate.json5"
 * - A path: "path/to/renovate.json5"
 * - A URL-encoded path: "src%2Frenovate%2Fconfig.json5"
 * - A GitLab API URL: "https://gitlab.example.com/api/v4/projects/13083/repository/files/renovate.json5?ref=main"
 *
 * @param fileName - The filename or path to extract from
 * @returns The extracted filename without path or query parameters
 */
export function extractFilenameFromGitLabPath(fileName: string): string {
  const url = parseUrl(fileName);
  if (url) {
    // If it's a valid URL, extract the pathname and process it
    let pathWithoutQuery = url.pathname;

    // Handle GitLab "/raw" suffix that's appended to the filename
    pathWithoutQuery = pathWithoutQuery.replace(regEx(/\/raw$/), '');

    // Extract filename from the path
    return pathWithoutQuery.split('/').pop() ?? '';
  }

  // Return as is - should be a normal filename with extension
  return fileName;
}

export function getPresetFromEndpoint(
  repo: string,
  presetName: string,
  presetPath?: string,
  endpoint = Endpoint,
  tag?: string,
): Promise<Nullish<Preset>> {
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
}: PresetConfig): Promise<Nullish<Preset>> {
  return getPresetFromEndpoint(repo, presetName, presetPath, Endpoint, tag);
}
