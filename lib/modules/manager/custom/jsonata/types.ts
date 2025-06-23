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
  fileFormat: string;
  matchStrings: string[];
}

export interface JsonataExtractConfig
  extends ExtractConfig,
    JSONataManagerTemplates {
  fileFormat: string;
  matchStrings: string[];
}
