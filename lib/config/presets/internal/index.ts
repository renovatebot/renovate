import type { Preset, PresetConfig } from '../types';
import * as configAbandonments from './abandonments';
import * as configPreset from './config';
import * as customManagersPreset from './custom-managers';
import * as defaultPreset from './default';
import * as dockerPreset from './docker';
import * as globalPreset from './global';
import * as groupPreset from './group';
import * as helpersPreset from './helpers';
import * as mergeConfidence from './merge-confidence';
import * as monorepoPreset from './monorepos';
import * as packagesPreset from './packages';
import * as previewPreset from './preview';
import * as replacements from './replacements';
import * as schedulePreset from './schedule';
import * as securityPreset from './security';
import * as workaroundsPreset from './workarounds';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const groups: Record<string, Record<string, Preset>> = {
  abandonments: configAbandonments.presets,
  config: configPreset.presets,
  customManagers: customManagersPreset.presets,
  default: defaultPreset.presets,
  docker: dockerPreset.presets,
  global: globalPreset.presets,
  group: groupPreset.presets,
  helpers: helpersPreset.presets,
  mergeConfidence: mergeConfidence.presets,
  monorepo: monorepoPreset.presets,
  packages: packagesPreset.presets,
  preview: previewPreset.presets,
  replacements: replacements.presets,
  schedule: schedulePreset.presets,
  security: securityPreset.presets,
  workarounds: workaroundsPreset.presets,
};

export function getPreset({
  repo,
  presetName,
}: PresetConfig): Preset | undefined {
  return groups[repo] && presetName ? groups[repo][presetName] : undefined;
}

function computeInternalPresets(): string[] {
  const internalPresets: string[] = [];

  for (const k in groups) {
    const v = groups[k];
    for (const kk in v) {
      if (k === 'default') {
        internalPresets.push(`:${kk}`);
        internalPresets.push(`default:${kk}`);
      } else {
        internalPresets.push(`${k}:${kk}`);
      }
    }
  }

  return internalPresets;
}

export const internalPresetNames = new Set(computeInternalPresets());

export function isInternal(preset: string): boolean {
  if (internalPresetNames.has(preset)) {
    return true;
  }

  // a parameterised preset is one that  that is parameterised will receive the argument `(...)`.
  // As we can't look up on the preset's values itself (as it could be in any property), we can look at the preset name itself, and see if it includes the start of an opening parenthesis
  const withoutParameterParts = preset.split('(');
  if (
    withoutParameterParts?.length &&
    internalPresetNames.has(withoutParameterParts[0])
  ) {
    return true;
  }

  return false;
}
