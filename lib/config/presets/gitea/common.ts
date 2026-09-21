import { logger } from '../../../logger/index.ts';
import {
  API_BASE_PATH,
  getRepoFile,
} from '../../../modules/platform/gitea/contents.ts';
import type { RepoContents } from '../../../modules/platform/gitea/schema.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import type { Nullish } from '../../../types/index.ts';
import type { GiteaHttp } from '../../../util/http/gitea.ts';
import type { Preset, PresetConfig } from '../types.ts';
import {
  PRESET_DEP_NOT_FOUND,
  PRESET_INVALID,
  fetchPreset,
  parsePreset,
} from '../util.ts';

export interface GiteaPresetSource {
  fetchJSONFile: (
    repo: string,
    fileName: string,
    endpoint: string,
    tag?: string | null,
  ) => Promise<Nullish<Preset>>;
  getPresetFromEndpoint: (
    repo: string,
    filePreset: string,
    presetPath?: string,
    endpoint?: string,
    tag?: string,
  ) => Promise<Nullish<Preset>>;
  getPreset: (config: PresetConfig) => Promise<Nullish<Preset>>;
}

/**
 * Builds the preset source of a platform which speaks the Gitea API.
 *
 * Forgejo is a fork of Gitea and serves the same contents API, so the Gitea
 * and Forgejo sources only differ in their Http client and default endpoint.
 */
export function createPresetSource(
  http: GiteaHttp,
  defaultEndpoint: string,
): GiteaPresetSource {
  async function fetchJSONFile(
    repo: string,
    fileName: string,
    endpoint: string,
    tag?: string | null,
  ): Promise<Nullish<Preset>> {
    let res: RepoContents;
    try {
      res = await getRepoFile(http, API_BASE_PATH, repo, fileName, tag, {
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

    let contentString: string;
    if (res.type === 'file') {
      contentString = res.contentString;
    } else {
      logger.debug(
        `Preset ${fileName} has unexpected type '${res.type}'. Only \`file\` is supported`,
      );
      throw new Error(PRESET_INVALID);
    }
    return parsePreset(contentString, fileName);
  }

  function getPresetFromEndpoint(
    repo: string,
    filePreset: string,
    presetPath?: string,
    endpoint = defaultEndpoint,
    tag?: string,
  ): Promise<Nullish<Preset>> {
    return fetchPreset({
      repo,
      filePreset,
      presetPath,
      endpoint,
      tag,
      fetch: fetchJSONFile,
    });
  }

  function getPreset({
    repo,
    presetName = 'default',
    presetPath,
    tag,
  }: PresetConfig): Promise<Nullish<Preset>> {
    return getPresetFromEndpoint(
      repo,
      presetName,
      presetPath,
      defaultEndpoint,
      tag,
    );
  }

  return { fetchJSONFile, getPresetFromEndpoint, getPreset };
}
