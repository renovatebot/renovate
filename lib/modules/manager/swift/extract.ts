import type { PackageFileContent } from '../types.ts';
import { parsePackageSwift } from './parser.ts';

export function extractPackageFile(content: string): PackageFileContent | null {
  if (!content) {
    return null;
  }

  const deps = parsePackageSwift(content);
  return deps?.length ? { deps } : null;
}
