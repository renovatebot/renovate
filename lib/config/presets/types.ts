import type { MaybePromise, Nullish } from '../../types';
import type { RenovateConfig } from '../types';

// TODO: Proper typing
export type Preset = RenovateConfig & Record<string, unknown>;

export interface PresetConfig {
  repo: string;
  presetPath?: string | undefined;
  presetName?: string;
  tag?: string | undefined;
}

export interface PresetApi {
  getPreset(config: PresetConfig): MaybePromise<Nullish<Preset>>;
}

export interface ParsedPreset {
  presetSource: string;
  repo: string;
  presetPath?: string | undefined;
  presetName: string;
  tag?: string | undefined;
  params?: string[] | undefined;
  rawParams?: string | undefined;
}

export type PresetFetcher = (
  repo: string,
  fileName: string,
  endpoint: string,
  tag?: string,
) => Promise<Nullish<Preset>>;

export interface FetchPresetConfig {
  repo: string;
  filePreset: string;
  presetPath?: string | undefined;
  endpoint: string;
  tag?: string | undefined;
  fetch: PresetFetcher;
}
