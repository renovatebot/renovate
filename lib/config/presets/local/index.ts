import { PlatformId } from '../../../constants';
import { GlobalConfig } from '../../global';
import * as azure from '../azure';
import * as bitbucket from '../bitbucket';
import * as bitbucketServer from '../bitbucket-server';
import * as gitea from '../gitea';
import * as github from '../github';
import * as gitlab from '../gitlab';
import type { Preset, PresetConfig } from '../types';
import * as local from './common';

const resolvers = {
  [PlatformId.Azure]: azure,
  [PlatformId.Bitbucket]: bitbucket,
  [PlatformId.BitbucketServer]: bitbucketServer,
  [PlatformId.CodeCommit]: local,
  [PlatformId.Gitea]: gitea,
  [PlatformId.Github]: github,
  [PlatformId.Gitlab]: gitlab,
} as const;

export function getPreset({
  repo,
  presetName = 'default',
  presetPath,
  tag,
}: PresetConfig): Promise<Preset | undefined> {
  const { platform, endpoint } = GlobalConfig.get();
  if (!platform) {
    throw new Error(`Missing platform config for local preset.`);
  }
  const resolver = resolvers[platform.toLowerCase() as PlatformId];
  if (!resolver) {
    throw new Error(
      // TODO: can be undefined? #7154
      `Unsupported platform '${platform}' for local preset.`
    );
  }
  return resolver.getPresetFromEndpoint(
    repo,
    presetName,
    presetPath,
    // TODO: fix type #7154
    endpoint!,
    tag
  );
}
