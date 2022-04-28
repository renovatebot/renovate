import type { RenovateConfig } from '../types';

// TODO: Proper typing
export type Preset = RenovateConfig & Record<string, unknown>;

export type PresetConfig = {
  repo: string;
  presetPath?: string;
  presetName?: string;
  baseConfig?: RenovateConfig;
  tag?: string;
};

export interface PresetApi {
  getPreset(
    config: PresetConfig
  ): Promise<Preset | null | undefined> | Preset | null | undefined;
}

export interface ParsedPreset {
  presetSource: string;
  repo: string;
  presetPath?: string;
  presetName: string;
  tag?: string;
  params?: string[];
}

export type PresetFetcher = (
  repo: string,
  fileName: string,
  endpoint: string,
  tag?: string | null
) => Promise<Preset | null | undefined>;

export type FetchPresetConfig = {
  repo: string;
  filePreset: string;
  presetPath?: string;
  endpoint: string;
  tag?: string | null;
  fetch: PresetFetcher;
};
