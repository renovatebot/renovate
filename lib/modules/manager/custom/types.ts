import type { RegexManagerConfig } from './regex/types';

export interface CustomExtractConfig extends Partial<RegexManagerConfig> {}

export type CustomManagerName = 'regex';

export interface CustomManager extends Partial<RegexManagerConfig> {
  customType: CustomManagerName;
  fileMatch: string[];
}

// NOTE:
// the two interfaces might seem similar but they have different usage similar to ManagerConfig and ExtractConfig
