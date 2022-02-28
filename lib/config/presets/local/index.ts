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
  repo,
  presetName = 'default',
  presetPath,
  packageTag,
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
    repo,
    presetName,
    presetPath,
    endpoint,
    packageTag
  );
}
