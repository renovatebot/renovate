import { Preset } from './common';
import * as gitlab from './gitlab';
import * as github from './github';
import { RenovateConfig } from '../common';

export function getPreset(
  pkgName: string,
  presetName = 'default',
  config: RenovateConfig
): Promise<Preset> {
  if (config.platform === 'gitlab') {
    return gitlab.getPreset(pkgName, presetName, config.endpoint);
  }
  if (config.platform === 'github') {
    return github.getPreset(pkgName, presetName, config.endpoint);
  }
  throw new Error('Not supported');
}
