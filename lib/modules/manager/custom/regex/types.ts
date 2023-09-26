import type { MatchStringsStrategy } from '../../../../config/types';

export interface ExtractionTemplate {
  groups: Record<string, string>;
  replaceString: string | undefined;
}

export interface RegexManagerTemplates {
  depNameTemplate?: string;
  packageNameTemplate?: string;
  datasourceTemplate?: string;
  versioningTemplate?: string;
  depTypeTemplate?: string;
  currentValueTemplate?: string;
  currentDigestTemplate?: string;
  extractVersionTemplate?: string;
  registryUrlTemplate?: string;
}

export interface RegexManagerConfig extends RegexManagerTemplates {
  matchStrings: string[];
  matchStringsStrategy?: MatchStringsStrategy;
  autoReplaceStringTemplate?: string;
}

export interface RecursionParameter {
  content: string;
  packageFile: string;
  config: RegexManagerConfig;
  regexes: RegExp[];
  index: number;
  combinedGroups: Record<string, string>;
}
