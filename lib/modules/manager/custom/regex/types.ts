import type { MatchStringsStrategy } from '../../../../config/types.ts';
import type { ExtractConfig } from '../../types.ts';

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

export interface RegexExtractConfig
  extends RegexManagerTemplates, ExtractConfig {
  matchStrings: string[];
  matchStringsStrategy?: MatchStringsStrategy;
  autoReplaceStringTemplate?: string;
}

export interface PackageFileInfo {
  /** full package file path ie. dir/folder/package.json */
  packageFile: string;
  /** extracted package file name ie. package.json */
  packageFileName: string;
  content: string;
  packageFileDir: string;
}

export interface RecursionParameter {
  content: string;
  packageFileInfo: PackageFileInfo;
  config: RegexExtractConfig;
  regexes: RegExp[];
  index: number;
  combinedGroups: Record<string, string>;
}
