import {
  PLATFORM_TYPE_GITHUB,
  PLATFORM_TYPE_GITLAB,
} from '../../constants/platforms';
import { RenovateConfig } from '../common';
import { Preset } from './common';
import * as github from './github';
import * as gitlab from './gitlab';

export async function getPreset(
  pkgName: string,
  presetName = 'default',
  baseConfig: RenovateConfig
): Promise<Preset> {
  const { platform, endpoint } = baseConfig;
  if (!platform) {
    throw new Error(`Missing platform config for local preset.`);
  }
  switch (platform.toLowerCase()) {
    case PLATFORM_TYPE_GITLAB:
      return gitlab.getPresetFromEndpoint(pkgName, presetName, endpoint);
    case PLATFORM_TYPE_GITHUB:
      return github.getPresetFromEndpoint(pkgName, presetName, endpoint);
    default:
      throw new Error(
        `Unsupported platform '${baseConfig.platform}' for local preset.`
      );
  }
}
