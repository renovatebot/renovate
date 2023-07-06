import type { Preset, PresetConfig } from '../types';
import * as configPreset from './config';
import * as defaultPreset from './default';
import * as dockerPreset from './docker';
import * as groupPreset from './group';
import * as helpersPreset from './helpers';
import * as mergeConfidence from './merge-confidence';
import * as monorepoPreset from './monorepo';
import * as npm from './npm';
import * as packagesPreset from './packages';
import * as previewPreset from './preview';
import * as regexManagersPreset from './regex-managers';
import * as replacements from './replacements';
import * as schedulePreset from './schedule';
import * as workaroundsPreset from './workarounds';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const groups: Record<string, Record<string, Preset>> = {
  config: configPreset.presets,
  default: defaultPreset.presets,
  docker: dockerPreset.presets,
  group: groupPreset.presets,
  helpers: helpersPreset.presets,
  mergeConfidence: mergeConfidence.presets,
  monorepo: monorepoPreset.presets,
  npm: npm.presets,
  packages: packagesPreset.presets,
  preview: previewPreset.presets,
  regexManagers: regexManagersPreset.presets,
  replacements: replacements.presets,
  schedule: schedulePreset.presets,
  workarounds: workaroundsPreset.presets,
};

export function getPreset({
  repo,
  presetName,
}: PresetConfig): Preset | undefined {
  return groups[repo] && presetName
    ? groups[repo][presetName]
    : /* istanbul ignore next */ undefined;
}
