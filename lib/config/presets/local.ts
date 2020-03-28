import { Preset } from './common';
import * as gitlab from './gitlab';
import * as github from './github';
import { RenovateConfig } from '../common';

export async function getPreset(
  pkgName: string,
  presetName = 'default',
  config: RenovateConfig
): Promise<Preset> {
  if (config.platform?.toLowerCase() === 'gitlab') {
    return gitlab.getPreset(pkgName, presetName, config.endpoint);
  }
  if (config.platform?.toLowerCase() === 'github') {
    return github.getPreset(pkgName, presetName, config.endpoint);
  }
  throw new Error(`Unsupport platform ${config.platform} for local preset.`);
}
