import type { PackageDependency } from '../types.ts';

export interface ExtractionResult {
  lineNumber: number;
  dependencies: PackageDependency[];
}
