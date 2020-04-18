import { Preset } from './common';
import * as gitlab from './gitlab';
import * as github from './github';
import { RenovateConfig } from '../common';

export async function getPreset(
  pkgName: string,
  presetName = 'default',
  baseConfig: RenovateConfig
): Promise<Preset> {
  if (baseConfig.platform?.toLowerCase() === 'gitlab') {
    return gitlab.getPreset(pkgName, presetName, baseConfig);
  }
  if (baseConfig.platform?.toLowerCase() === 'github') {
    return github.getPreset(pkgName, presetName, baseConfig);
  }
  throw new Error(
    `Unsupported platform '${baseConfig.platform}' for local preset.`
  );
}
