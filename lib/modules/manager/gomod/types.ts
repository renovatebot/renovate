import type { PackageDependency } from '../types.ts';

export interface GoModManagerData {
  lineNumber?: number;
  multiLine?: boolean;
}

export interface MultiLineParseResult {
  reachedLine: number;
  detectedDeps: PackageDependency<GoModManagerData>[];
}

export interface ExtraDep {
  depName: string;
  currentValue: string;
  newValue: string;
}
