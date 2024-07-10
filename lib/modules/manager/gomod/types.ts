import type { PackageDependency } from '../types';

export interface MultiLineParseResult {
  reachedLine: number;
  detectedDeps: PackageDependency[];
}

export interface ExtraDep {
  depName: string;
  currentValue: string;
  newValue: string;
}
