import type { ExtractConfig, PackageFile } from '../../../types.ts';
import type { NpmManagerData } from '../../types.ts';
import { setNpmrcMinimumReleaseAge } from '../npmrc.ts';
import { setPnpmMinimumReleaseAge } from '../pnpm-minimum-release-age.ts';
import { setYarnMinimumReleaseAge } from '../yarn-minimum-release-age.ts';
import { getLockedVersions } from './locked-versions.ts';
import { detectMonorepos } from './monorepo.ts';

// A dep's own managerData (e.g. nested override parents) replaces the package
// file's when upgrades are flattened, so merge the package file's in here.
function inheritPackageFileManagerData(
  packageFiles: PackageFile<NpmManagerData>[],
): void {
  for (const { managerData, deps } of packageFiles) {
    for (const dep of deps) {
      if (dep.managerData) {
        dep.managerData = { ...managerData, ...dep.managerData };
      }
    }
  }
}

export async function postExtract(
  packageFiles: PackageFile<NpmManagerData>[],
  config: ExtractConfig,
): Promise<void> {
  await detectMonorepos(packageFiles);
  await getLockedVersions(packageFiles);
  setNpmrcMinimumReleaseAge(packageFiles);
  await setPnpmMinimumReleaseAge(packageFiles, config);
  await setYarnMinimumReleaseAge(packageFiles, config);
  inheritPackageFileManagerData(packageFiles);
}
