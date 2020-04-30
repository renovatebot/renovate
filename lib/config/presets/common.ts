import { RenovateConfig } from '../common';

// TODO: Proper typing
export type Preset = RenovateConfig & Record<string, unknown>;

export interface PresetApi {
  getPreset(
    pkgName: string,
    presetName?: string,
    baseConfig?: RenovateConfig
  ): Promise<Preset> | Preset;
}
