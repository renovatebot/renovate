import type { PackageDependency } from '../types';

export interface ExtractionResult {
  deps: PackageDependency[];
  referencedConfigFiles: string[];
}
