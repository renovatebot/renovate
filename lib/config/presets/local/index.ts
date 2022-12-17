import type { PlatformId } from '../../../constants';
import { GlobalConfig } from '../../global';
import * as gitea from '../gitea';
import * as github from '../github';
import * as gitlab from '../gitlab';
import type { Preset, PresetConfig } from '../types';
import * as local from './common';

const resolvers = {
  azure: local,
  bitbucket: local,
  'bitbucket-server': local,
  gitea,
  github,
  gitlab,
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
