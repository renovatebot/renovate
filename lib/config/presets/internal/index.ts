import type { Preset, PresetConfig } from '../types.ts';
import * as configAbandonments from './abandonments.preset.ts';
import * as configPreset from './config.preset.ts';
import * as customManagersPreset from './custom-managers.preset.ts';
import * as defaultPreset from './default.preset.ts';
import * as dockerPreset from './docker.preset.ts';
import * as globalPreset from './global.preset.ts';
import * as groupPreset from './group.preset.ts';
import * as helpersPreset from './helpers.preset.ts';
import * as mergeConfidence from './merge-confidence.preset.ts';
import * as monorepoPreset from './monorepos.preset.ts';
import * as packagesPreset from './packages.preset.ts';
import * as previewPreset from './preview.preset.ts';
import * as replacements from './replacements.preset.ts';
import * as schedulePreset from './schedule.preset.ts';
import * as securityPreset from './security.preset.ts';
import * as workaroundsPreset from './workarounds.preset.ts';

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
