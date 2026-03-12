import type { PackageDependency } from '../types.ts';

export interface ExtractionResult {
  deps: PackageDependency[];
  referencedConfigFiles: string[];
}
