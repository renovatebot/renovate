import type { RenovateConfig } from '../types';

// TODO: Proper typing
export type Preset = RenovateConfig & Record<string, unknown>;

export type PresetConfig = {
  packageName: string;
  presetPath?: string;
  presetName?: string;
  baseConfig?: RenovateConfig;
  packageTag?: string;
};

export interface PresetApi {
  getPreset(config: PresetConfig): Promise<Preset> | Preset;
}

export interface ParsedPreset {
  presetSource: string;
  packageName: string;
  presetPath?: string;
  presetName: string;
  packageTag?: string;
  params?: string[];
}

export type PresetFetcher = (
  repo: string,
  fileName: string,
  endpoint: string,
  packageTag?: string
) => Promise<Preset>;

export type FetchPresetConfig = {
  pkgName: string;
  filePreset: string;
  presetPath?: string;
  endpoint: string;
  packageTag?: string;
  fetch: PresetFetcher;
};
