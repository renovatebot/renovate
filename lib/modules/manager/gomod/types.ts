import type { PackageDependency } from '../types';

export interface MultiLineParseResult {
  reachedLine: number;
  detectedDeps: PackageDependency[];
}
