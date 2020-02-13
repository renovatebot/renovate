import { PackageFile, PackageDependency } from '../common';
import { extractBase, extractImage, parseKustomize } from './common';
import { getDep } from '../dockerfile/extract';
import { logger } from '../../logger';

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace('kustomize.extractPackageFile()');
  let deps: PackageDependency[] = [];
  let lineNumber = 0;

  let pkg = parseKustomize(content);
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

  // grab the image tags
  for (const image of pkg.images) {
    const dep = extractImage(image);
    if (dep) {
      deps.push(dep);
    }
  }

  if (!deps.length) {
    return null;
  }
  return { deps };
}
