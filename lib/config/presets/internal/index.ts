import { Preset, PresetConfig } from '../common';
import * as configPreset from './config';
import * as defaultPreset from './default';
import * as dockerPreset from './docker';
import * as groupPreset from './group';
import * as helpersPreset from './helpers';
import * as monorepoPreset from './monorepo';
import * as npm from './npm';
import * as packagesPreset from './packages';
import * as previewPreset from './preview';
import * as schedulePreset from './schedule';
import * as workaroundsPreset from './workarounds';

export const groups: Record<string, Record<string, Preset>> = {
  config: configPreset.presets,
  default: defaultPreset.presets,
  docker: dockerPreset.presets,
  group: groupPreset.presets,
  helpers: helpersPreset.presets,
  monorepo: monorepoPreset.presets,
  npm: npm.presets,
  packages: packagesPreset.presets,
  preview: previewPreset.presets,
  schedule: schedulePreset.presets,
  workarounds: workaroundsPreset.presets,
};

export function getPreset({
  packageName: pkgName,
  presetName,
}: PresetConfig): Preset | undefined {
  return groups[pkgName]
    ? groups[pkgName][presetName]
    : /* istanbul ignore next */ undefined;
}
