import type { ExtractConfig } from '../../types.ts';

export interface JSONataManagerTemplates {
  depNameTemplate?: string;
  packageNameTemplate?: string;
  datasourceTemplate?: string;
  versioningTemplate?: string;
  depTypeTemplate?: string;
  currentValueTemplate?: string;
  currentDigestTemplate?: string;
  extractVersionTemplate?: string;
  registryUrlTemplate?: string;
  /**
   * Lets a JSONata manager reshape the updated value before it is written back,
   * e.g. to re-pad a 4-segment version that the datasource returns as 3 segments
   * Needed because the extracted value and the new value can differ in format
   */
  autoReplaceStringTemplate?: string;
}

export interface JSONataManagerConfig extends JSONataManagerTemplates {
  fileFormat: string;
  matchStrings: string[];
}

export interface JsonataExtractConfig
  extends ExtractConfig, JSONataManagerTemplates {
  fileFormat: string;
  matchStrings: string[];
}
