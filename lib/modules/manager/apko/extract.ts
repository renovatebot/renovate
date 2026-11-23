import type { PackageFileContent } from '../types.ts';

export function extractPackageFile(
  _content: string,
  _packageFile?: string,
): Promise<PackageFileContent | null> {
  return Promise.reject(new Error('not implemented'));
}
