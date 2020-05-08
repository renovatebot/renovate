import { RenovateConfig } from '../common';
import { Preset } from './common';
import { getPresetFromEndpoint } from './local/gitlab';

export function getPreset(
  pkgName: string,
  presetName = 'default',
  _baseConfig?: RenovateConfig
): Promise<Preset> {
  return getPresetFromEndpoint(pkgName, presetName);
}
