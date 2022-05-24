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
} as const;

export function getPreset({
  repo,
  presetName = 'default',
  presetPath,
  tag,
  baseConfig,
}: PresetConfig): Promise<Preset | undefined> {
  const { platform, endpoint } = baseConfig ?? {};
  if (!platform) {
    throw new Error(`Missing platform config for local preset.`);
  }
  const resolver = resolvers[platform.toLowerCase() as PlatformId];
  if (!resolver) {
    throw new Error(
      // TODO: can be undefined? #7154
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      `Unsupported platform '${baseConfig!.platform}' for local preset.`
    );
  }
  return resolver.getPresetFromEndpoint(
    repo,
    presetName,
    presetPath,
    // TODO: fix type #7154
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    endpoint!,
    tag
  );
}
