import type { PackageFileContent } from '../types';
import { parse } from './parser';

export function extractPackageFile(
  content: string,
  _packageFile?: string,
): PackageFileContent | null {
  const result = parse(content);
  if (!result?.deps.length) {
    return null;
  }

  const { deps, perlVersion } = result;
  const extractedConstraints = perlVersion ? { perl: perlVersion } : undefined;
  return { deps, ...(extractedConstraints && { extractedConstraints }) };
}
