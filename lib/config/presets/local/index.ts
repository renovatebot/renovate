import { PlatformId } from '../../../constants';
import * as azure from '../azure';
import * as bitbucket from '../bitbucket';
import * as bitbucketServer from '../bitbucket-server';
import * as gitea from '../gitea';
import * as github from '../github';
import * as gitlab from '../gitlab';
import type { Preset, PresetConfig } from '../types';

type PresetApi =
  | typeof azure
  | typeof bitbucket
  | typeof bitbucketServer
  | typeof gitea
  | typeof github
  | typeof gitlab;

const resolvers: Record<PlatformId, PresetApi> = {
  ['azure']: azure,
  ['bitbucket']: bitbucket,
  ['bitbucket-server']: bitbucketServer,
  ['gitea']: gitea,
  ['github']: github,
  ['gitlab']: gitlab,
};

export function getPreset({
  packageName: pkgName,
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
    pkgName,
    presetName,
    presetPath,
    endpoint,
    packageTag
  );
}
