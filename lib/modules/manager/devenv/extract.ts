import { extractFlakeLock } from '../nix/extract';
import type { ExtractConfig, PackageFileContent } from '../types';

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config?: ExtractConfig,
): Promise<PackageFileContent | null> {
  return await extractFlakeLock(content, packageFile, 'devenv.lock', config);
}
