import type { ExtractConfig } from '../../types';

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
}

export interface JSONataManagerConfig extends JSONataManagerTemplates {
  matchStrings: string[];
  autoReplaceStringTemplate?: string;
}

export interface JsonataExtractConfig
  extends ExtractConfig,
    JSONataManagerTemplates {
  autoReplaceStringTemplate?: string;
  matchStrings: string[];
}
