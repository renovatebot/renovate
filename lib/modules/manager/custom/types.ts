import type { RegexManagerConfig } from './regex/types';

export interface CustomExtractConfig extends Partial<RegexManagerConfig> {}

export type CustomManagerName = 'regex';

export interface CustomManager extends Partial<RegexManagerConfig> {
  customType: CustomManagerName;
  fileMatch: string[];
}

// NOTE:
// the two interfaces might seem similar but they have different usage...
// CustomManager interface consists of all fields that a custom manager can have
// whereas
// CustomExtractConfig consists of the fields that custom managers need when performing extraction
// ie. options necessary for the function extractPackageFile
