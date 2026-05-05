import type { CustomType } from '../../../config/allowed-values.generated.ts';
import type { JSONataManagerConfig } from './jsonata/types.ts';
import type { RegexManagerConfig } from './regex/types.ts';

export interface CustomExtractConfig
  extends Partial<RegexManagerConfig>, Partial<JSONataManagerConfig> {}

export type CustomManagerName = CustomType;

export interface CustomManager
  extends Partial<RegexManagerConfig>, Partial<JSONataManagerConfig> {
  customType: CustomManagerName;
  managerFilePatterns: string[];
}

// NOTE:
// the two interfaces might seem similar but they have different usage similar to ManagerConfig and ExtractConfig
