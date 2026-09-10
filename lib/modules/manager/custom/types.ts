import type { JSONataManagerConfig } from './jsonata/types.ts';
import type { RegexManagerConfig } from './regex/types.ts';
import type { validMatchFields } from './utils.ts';

export interface CustomExtractConfig
  extends Partial<RegexManagerConfig>, Partial<JSONataManagerConfig> {}

export type CustomManagerName = 'jsonata' | 'regex';

export interface CustomManager
  extends Partial<RegexManagerConfig>, Partial<JSONataManagerConfig> {
  customType: CustomManagerName;
  managerFilePatterns: string[];
}

// NOTE:
// the two interfaces might seem similar but they have different usage similar to ManagerConfig and ExtractConfig

export type ValidMatchFields = (typeof validMatchFields)[number];
