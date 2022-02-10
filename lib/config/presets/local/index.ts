import { PlatformId } from '../../../constants';
import * as azure from '../azure';
import * as bitbucket from '../bitbucket';
import * as bitbucketServer from '../bitbucket-server';
import * as gitea from '../gitea';
import * as github from '../github';
import * as gitlab from '../gitlab';
import type { Preset, PresetConfig } from '../types';

const resolvers = {
  [PlatformId.Azure]: azure,
  [PlatformId.Bitbucket]: bitbucket,
  [PlatformId.BitbucketServer]: bitbucketServer,
  [PlatformId.Gitea]: gitea,
  [PlatformId.Github]: github,
  [PlatformId.Gitlab]: gitlab,
};

export function getPreset({
  packageName: pkgName,
  presetName = 'default',
  presetPath,
  packageTag,
  baseConfig,
}: PresetConfig): Promise<Preset> {
  const { platform, endpoint } = baseConfig ?? {};
  if (!platform) {
    throw new Error(`Missing platform config for local preset.`);
  }
  const platformId = platform.toLowerCase() as keyof typeof resolvers;
  const resolver = resolvers[platformId];
  if (!resolver) {
    throw new Error(`Unsupported platform '${platform}' for local preset.`);
  }
  return resolver.getPresetFromEndpoint(
    pkgName,
    presetName,
    presetPath,
    endpoint,
    packageTag
  );
}
