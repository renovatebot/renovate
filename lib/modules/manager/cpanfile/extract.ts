import type { PackageFileContent } from '../types';
import { parse } from './parser';

export function extractPackageFile(
  content: string,
  packageFile?: string
): PackageFileContent | null {
  const deps = parse(content, packageFile);
  if (deps?.length) {
    return { deps };
  } else {
    return null;
  }
}
