import type { CustomExtractConfig } from '../../types';

export interface ExtractionTemplate {
  groups: Record<string, string>;
  replaceString: string | undefined;
}

export interface RecursionParameter {
  content: string;
  packageFile: string;
  config: CustomExtractConfig;
  regexes: RegExp[];
  index: number;
  combinedGroups: Record<string, string>;
}

export interface RegexManagerConfig extends CustomExtractConfig {
  matchStrings: string[];
}
