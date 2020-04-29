import { Preset } from '../common';
import * as configPreset from './config';
import * as defaultPreset from './default';
import * as dockerPreset from './docker';
import * as groupPreset from './group';
import * as helpersPreset from './helpers';
import * as monorepoPreset from './monorepo';
import * as packagesPreset from './packages';
import * as previewPreset from './preview';
import * as schedulePreset from './schedule';

export const groups: Record<string, Record<string, Preset>> = {
  config: configPreset.presets,
  default: defaultPreset.presets,
  docker: dockerPreset.presets,
  group: groupPreset.presets,
  helpers: helpersPreset.presets,
  monorepo: monorepoPreset.presets,
  packages: packagesPreset.presets,
  preview: previewPreset.presets,
  schedule: schedulePreset.presets,
};

export function getPreset(
  pkgName: string,
  presetName: string
): Preset | undefined {
  return groups[pkgName] ? groups[pkgName][presetName] : undefined;
}
