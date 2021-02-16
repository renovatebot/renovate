import {
  PLATFORM_TYPE_BITBUCKET_SERVER,
  PLATFORM_TYPE_GITEA,
  PLATFORM_TYPE_GITHUB,
  PLATFORM_TYPE_GITLAB,
} from '../../../constants/platforms';
import * as bitbucketServer from '../bitbucket-server';
import { Preset, PresetConfig } from '../common';
import * as gitea from '../gitea';
import * as github from '../github';
import * as gitlab from '../gitlab';

export function getPreset({
  packageName: pkgName,
  presetName = 'default',
  presetPath,
  baseConfig,
}: PresetConfig): Promise<Preset> {
  const { platform, endpoint } = baseConfig;
  if (!platform) {
    throw new Error(`Missing platform config for local preset.`);
  }
  switch (platform.toLowerCase()) {
    case PLATFORM_TYPE_GITLAB:
      return gitlab.getPresetFromEndpoint(
        pkgName,
        presetName,
        presetPath,
        endpoint
      );
    case PLATFORM_TYPE_GITHUB:
      return github.getPresetFromEndpoint(
        pkgName,
        presetName,
        presetPath,
        endpoint
      );
    case PLATFORM_TYPE_BITBUCKET_SERVER:
      return bitbucketServer.getPresetFromEndpoint(
        pkgName,
        presetName,
        endpoint
      );
    case PLATFORM_TYPE_GITEA:
      return gitea.getPresetFromEndpoint(
        pkgName,
        presetName,
        presetPath,
        endpoint
      );
    default:
      throw new Error(
        `Unsupported platform '${baseConfig.platform}' for local preset.`
      );
  }
}
