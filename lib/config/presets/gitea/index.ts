import { giteaHttp } from '../../../modules/platform/gitea/index.ts';
import { createPresetSource } from './common.ts';

export const Endpoint = 'https://gitea.com/';

export const { fetchJSONFile, getPresetFromEndpoint, getPreset } =
  createPresetSource(giteaHttp, Endpoint);
