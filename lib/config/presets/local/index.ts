import type { PlatformId } from '../../../constants/index.ts';
import type { Nullish } from '../../../types/index.ts';
import { GlobalConfig } from '../../global.ts';
import * as forgejo from '../forgejo/index.ts';
import * as gitea from '../gitea/index.ts';
import * as github from '../github/index.ts';
import * as gitlab from '../gitlab/index.ts';
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

const resolvers = {
  azure: local,
  bitbucket: local,
  'bitbucket-server': local,
  codecommit: null,
  forgejo,
  gerrit: local,
  gitea,
  github,
  gitlab,
  local: null,
} satisfies Record<PlatformId, Resolver | null>;

export function getPreset({
  repo,
  presetName = 'default',
  presetPath,
  tag,
}: PresetConfig): Promise<Nullish<Preset>> {
  const platform = GlobalConfig.get('platform');
  if (!platform) {
    throw new Error(`Missing platform config for local preset.`);
  }
  const resolver = resolvers[platform];
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
    // TODO: fix type #22198
    endpoint!,
    tag,
  );
}
