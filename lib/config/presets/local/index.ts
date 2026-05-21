import type { PlatformId } from '../../../constants/index.ts';
import type { Nullish } from '../../../types/index.ts';
import { GlobalConfig } from '../../global.ts';
import type { Preset, PresetConfig } from '../types.ts';
import * as local from './common.ts';

interface Resolver {
  getPresetFromEndpoint(
    repo: string,
    filePreset: string,
    presetPath?: string,
    endpoint?: string,
    tag?: string,
  ): Promise<Nullish<Preset>>;
}

type ResolverOrNull = Resolver | null;

async function getResolver(platform: PlatformId): Promise<ResolverOrNull> {
  switch (platform) {
    case 'forgejo':
      return import('../forgejo/index.ts');
    case 'gitea':
      return import('../gitea/index.ts');
    case 'github':
      return import('../github/index.ts');
    case 'gitlab':
      return import('../gitlab/index.ts');
    case 'azure':
    case 'bitbucket':
    case 'bitbucket-server':
    case 'gerrit':
      return local;
    case 'codecommit':
    case 'local':
    case 'scm-manager':
      return null;
  }
}

export async function getPreset({
  repo,
  presetName = 'default',
  presetPath,
  tag,
}: PresetConfig): Promise<Nullish<Preset>> {
  const platform = GlobalConfig.get('platform');
  if (!platform) {
    throw new Error(`Missing platform config for local preset.`);
  }
  const resolver = await getResolver(platform);
  if (!resolver) {
    throw new Error(
      `The platform you're using (${platform}) does not support local presets.`,
    );
  }
  const endpoint = GlobalConfig.get('endpoint');
  return resolver.getPresetFromEndpoint(
    repo,
    presetName,
    presetPath,
    endpoint,
    tag,
  );
}
