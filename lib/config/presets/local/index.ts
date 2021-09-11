import { PlatformID } from '../../../constants/platforms';
import * as azure from '../azure';
import * as bitbucket from '../bitbucket';
import * as bitbucketServer from '../bitbucket-server';
import * as gitea from '../gitea';
import * as github from '../github';
import * as gitlab from '../gitlab';
import type { Preset, PresetConfig } from '../types';

const resolvers = {
  [PlatformID.Azure]: azure,
  [PlatformID.Bitbucket]: bitbucket,
  [PlatformID.BitbucketServer]: bitbucketServer,
  [PlatformID.Gitea]: gitea,
  [PlatformID.Github]: github,
  [PlatformID.Gitlab]: gitlab,
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
