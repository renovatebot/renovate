import type { PackageFile } from '../../../types.ts';
import type { NpmManagerData } from '../../types.ts';
import { setNpmrcMinimumReleaseAge } from '../npmrc.ts';
import { setPnpmMinimumReleaseAge } from '../pnpm-minimum-release-age.ts';
import { getLockedVersions } from './locked-versions.ts';
import { detectMonorepos } from './monorepo.ts';

export async function postExtract(
  packageFiles: PackageFile<NpmManagerData>[],
): Promise<void> {
  await detectMonorepos(packageFiles);
  await getLockedVersions(packageFiles);
  setNpmrcMinimumReleaseAge(packageFiles);
  await setPnpmMinimumReleaseAge(packageFiles);
}
