import { Preset } from './common';

export function getPreset(
  pkgName: string,
  presetName = 'default'
): Promise<Preset> {
  throw new Error('Not supported');
}
