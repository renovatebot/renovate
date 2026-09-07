import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import type { Nullish } from '../../../types/index.ts';
import type { Preset } from '../types.ts';
import {
  PRESET_DEP_NOT_FOUND,
  PRESET_INVALID,
  fetchPreset,
  parsePreset,
} from '../util.ts';

/**
 * Shared implementation for the Gitea-compatible preset sources.
 *
 * Forgejo is a fork of Gitea and serves the same contents API, so both sources
 * only differ in their default endpoint and in the platform helper they read
 * repository contents with.
 */

/** The subset of the contents API response a preset lookup reads. */
export interface PresetContents {
  type?: string;
  contentString?: string;
}

export type GetRepoContents = (
  repo: string,
  fileName: string,
  tag: string | null | undefined,
  options: { baseUrl: string },
) => Promise<PresetContents>;

export async function fetchJSONFile(
  getRepoContents: GetRepoContents,
  repo: string,
  fileName: string,
  endpoint: string,
  tag?: string | null,
): Promise<Nullish<Preset>> {
  let res: PresetContents;
  try {
    res = await getRepoContents(repo, fileName, tag, {
      baseUrl: endpoint,
    });
  } catch (err) {
    if (err instanceof ExternalHostError) {
      throw err;
    }
    logger.debug(
      `Preset file ${fileName} not found in ${repo}: ${err.message}`,
    );
    throw new Error(PRESET_DEP_NOT_FOUND);
  }

  if (res.type && res.type !== 'file') {
    logger.debug(
      `Preset ${fileName} has unexpected type '${res.type}'. Only \`file\` is supported`,
    );
    throw new Error(PRESET_INVALID);
  }

  return parsePreset(res.contentString, fileName);
}

export function getPresetFromEndpoint(
  getRepoContents: GetRepoContents,
  repo: string,
  filePreset: string,
  presetPath: string | undefined,
  endpoint: string,
  tag?: string,
): Promise<Nullish<Preset>> {
  return fetchPreset({
    repo,
    filePreset,
    presetPath,
    endpoint,
    tag,
    fetch: (fetchRepo, fetchFileName, fetchEndpoint, fetchTag) =>
      fetchJSONFile(
        getRepoContents,
        fetchRepo,
        fetchFileName,
        fetchEndpoint,
        fetchTag,
      ),
  });
}
