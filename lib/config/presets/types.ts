import { RenovateConfig } from '../types';

// TODO: Proper typing
export type Preset = RenovateConfig & Record<string, unknown>;

export type PresetConfig = {
  packageName: string;
  presetName?: string;
  baseConfig?: RenovateConfig;
};

export interface PresetApi {
  getPreset(config: PresetConfig): Promise<Preset> | Preset;
}

export interface ParsedPreset {
  presetSource: string;
  packageName: string;
  presetName: string;
  params?: string[];
}
