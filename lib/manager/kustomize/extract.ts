import { PackageFile, PackageDependency } from '../common';
import { extractBase, extractBases } from './common';
import { getDep } from '../dockerfile/extract';
import { logger } from '../../logger';

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace('kustomize.extractPackageFile()');
  let deps: PackageDependency[] = [];
  let lineNumber = 0;

  let pkg = extractBases(content);
  if (!pkg) {
    return null;
  }

  // grab the remote bases
  for (const base of pkg.bases) {
    const dep = extractBase(base);
    if (dep) {
      deps.push(dep);
    }
  }

  if (!deps.length) {
    return null;
  }
  return { deps };
}
