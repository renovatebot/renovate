import type { PackageFile } from '../../../types';
import type { NpmManagerData } from '../../types';
import { getLockedVersions } from './locked-versions';
import { detectMonorepos } from './monorepo';

export async function postExtract(
  packageFiles: PackageFile<NpmManagerData>[],
): Promise<void> {
  await detectMonorepos(packageFiles);
  await getLockedVersions(packageFiles);
}
