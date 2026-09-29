import { forgejoHttp } from '../../../modules/platform/forgejo/index.ts';
import { createPresetSource } from '../gitea/common.ts';

export const Endpoint = 'https://code.forgejo.org/';

export const { fetchJSONFile, getPresetFromEndpoint, getPreset } =
  createPresetSource(forgejoHttp, Endpoint);
