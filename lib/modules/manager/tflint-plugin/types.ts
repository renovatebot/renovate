import type { PackageDependency } from '../types';

export interface ExtractionResult {
  lineNumber: number;
  dependencies: PackageDependency<TFLintManagerData>[];
}

export interface TFLintManagerData {
  pluginName?: string;
  source?: string;
  sourceLine?: number;
}
