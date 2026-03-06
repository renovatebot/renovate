import type { PackageFileContent } from '../types.ts';
import { extractPep723 } from './utils.ts';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  return extractPep723(content, packageFile);
}
