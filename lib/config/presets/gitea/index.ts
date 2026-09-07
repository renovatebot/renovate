import { GiteaHttp } from '../../../util/http/gitea.ts';
import { createPresetSource } from './common.ts';

export const Endpoint = 'https://gitea.com/';

export const { fetchJSONFile, getPresetFromEndpoint, getPreset } =
  createPresetSource(new GiteaHttp(), Endpoint);
