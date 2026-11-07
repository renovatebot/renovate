import type { PackageFile } from '../../../types.ts';
import type { NpmManagerData } from '../../types.ts';
import { getLockedVersions } from './locked-versions.ts';
import { detectMonorepos } from './monorepo.ts';
import { addTransitiveDeps } from './transitive.ts';

export async function postExtract(
  packageFiles: PackageFile<NpmManagerData>[],
  hasVulnerabilityAlertsRules = false,
): Promise<void> {
  await detectMonorepos(packageFiles);
  await getLockedVersions(packageFiles);
  if (hasVulnerabilityAlertsRules) {
    await addTransitiveDeps(packageFiles);
  }
}
