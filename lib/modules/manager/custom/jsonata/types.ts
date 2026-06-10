import type { FileFormat } from '../../../../config/allowed-values.generated.ts';
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
}

export interface JSONataManagerConfig extends JSONataManagerTemplates {
  fileFormat: FileFormat;
  matchStrings: string[];
}

export interface JsonataExtractConfig
  extends ExtractConfig, JSONataManagerTemplates {
  fileFormat: FileFormat;
  matchStrings: string[];
}
