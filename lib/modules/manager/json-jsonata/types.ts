import type { JSONataManagerTemplates } from '../../../config/types';
import type { ExtractConfig } from '../types';

export interface CustomExtractConfig
  extends ExtractConfig,
    JSONataManagerTemplates {
  autoReplaceStringTemplate?: string;
  matchQueries: string[];
}
