import type { PackageDependency } from '../types.ts';

export interface MultiLineParseResult {
  reachedLine: number;
  detectedDeps: PackageDependency[];
}

export interface ExtraDep {
  depName: string;
  currentValue: string;
  newValue: string;
}

export interface GoModulesTidyPlan {
  modules: string[];
  containsCycle: boolean;
}
