import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { extractPackageJson } from '../npm/extract/common/package-file';
import type { NpmPackage } from '../npm/extract/types';
import type { PackageFile } from '../types';
import type { DenoManagerData } from './types';

export async function extractDenoCompatiblePackageJson(
  matchedFile: string,
): Promise<PackageFile<DenoManagerData> | null> {
  const packageFileContent = await readLocalFile(matchedFile, 'utf8');
  if (!packageFileContent) {
    logger.debug({ packageFile: matchedFile }, 'Deno: No package.json found');
    return null;
  }

  let packageJson: NpmPackage;
  try {
    packageJson = JSON.parse(packageFileContent);
  } catch (err) {
    logger.error({ err }, 'Error parsing package.json');
    return null;
  }

  const extracted = extractPackageJson(packageJson, matchedFile);
  if (!extracted) {
    return null;
  }

  for (const dep of extracted.deps) {
    if (!dep.currentRawValue) {
      continue;
    }

    // https://github.com/denoland/deno_npm/blob/722fbecb5bdbd93241e5fc774cc1deaebd40365b/src/registry.rs#L289-L297
    if (
      dep.currentRawValue?.startsWith('https://') ||
      dep.currentRawValue?.startsWith('http://') ||
      dep.currentRawValue?.startsWith('git:') ||
      dep.currentRawValue?.startsWith('github:') ||
      dep.currentRawValue?.startsWith('git+')
    ) {
      dep.skipReason = 'unsupported-remote';
    }
  }

  const res: PackageFile<DenoManagerData> = {
    ...extracted,
    managerData: {
      packageName: extracted.managerData?.packageJsonName,
      workspaces: extracted.managerData?.workspaces,
    },
    packageFile: matchedFile,
  };
  return res;
}
