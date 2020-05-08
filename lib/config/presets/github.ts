import { Preset, PresetConfig } from './common';
import { getPresetFromEndpoint } from './local/github';

export function getPreset({
  packageName: pkgName,
  presetName = 'default',
}: PresetConfig): Promise<Preset> {
  return getPresetFromEndpoint(pkgName, presetName);
}
