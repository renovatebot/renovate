import { ForgejoHttp } from '../../../util/http/forgejo.ts';
import { createPresetSource } from '../gitea/common.ts';

export const Endpoint = 'https://code.forgejo.org/';

export const { fetchJSONFile, getPresetFromEndpoint, getPreset } =
  createPresetSource(new ForgejoHttp(), Endpoint);
