import type { PlatformId } from '../../../constants';
import { GlobalConfig } from '../../global';
import * as gitea from '../gitea';
import * as github from '../github';
import * as gitlab from '../gitlab';
import type { Preset, PresetConfig } from '../types';
import * as local from './common';

interface Resolver {
  getPresetFromEndpoint(
    repo: string,
    filePreset: string,
    presetPath?: string,
    endpoint?: string,
    tag?: string,
  ): Promise<Preset | undefined>;
}

const resolvers = {
  azure: local,
  bitbucket: local,
  'bitbucket-server': local,
  codecommit: null,
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
}: PresetConfig): Promise<Preset | undefined> {
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
