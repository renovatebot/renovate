import { RenovateConfig } from '../common';

// TODO: Proper typing
export type Preset = RenovateConfig & Record<string, unknown>;

export type PresetConfig = {
  packageName: string;
  presetPath?: string;
  presetName?: string;
  baseConfig?: RenovateConfig;
};

export interface PresetApi {
  getPreset(config: PresetConfig): Promise<Preset> | Preset;
}
