import {
  PLATFORM_TYPE_AZURE,
  PLATFORM_TYPE_BITBUCKET,
  PLATFORM_TYPE_BITBUCKET_SERVER,
  PLATFORM_TYPE_GITEA,
  PLATFORM_TYPE_GITHUB,
  PLATFORM_TYPE_GITLAB,
} from '../../../constants/platforms';
import * as azure from '../azure';
import * as bitbucket from '../bitbucket';
import * as bitbucketServer from '../bitbucket-server';
import * as gitea from '../gitea';
import * as github from '../github';
import * as gitlab from '../gitlab';
import type { Preset, PresetConfig } from '../types';

const resolvers = {
  [PLATFORM_TYPE_AZURE]: azure,
  [PLATFORM_TYPE_BITBUCKET]: bitbucket,
  [PLATFORM_TYPE_BITBUCKET_SERVER]: bitbucketServer,
  [PLATFORM_TYPE_GITEA]: gitea,
  [PLATFORM_TYPE_GITHUB]: github,
  [PLATFORM_TYPE_GITLAB]: gitlab,
};

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
  const resolver = resolvers[platform.toLowerCase()];
  if (!resolver) {
    throw new Error(
      `Unsupported platform '${baseConfig.platform}' for local preset.`
    );
  }
  return resolver.getPresetFromEndpoint(
    pkgName,
    presetName,
    presetPath,
    endpoint
  );
}
