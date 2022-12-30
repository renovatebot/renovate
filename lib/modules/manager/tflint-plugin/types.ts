import type { PackageDependency } from '../types';

export interface ExtractionResult {
  lineNumber: number;
  dependencies: PackageDependency[];
}
