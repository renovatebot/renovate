import { logger } from '../../logger';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace('kubernetes.extractPackageFile()');
  let deps: PackageDependency[] = [];

  const isKubernetesManifest =
    /\s*apiVersion\s*:/.test(content) && /\s*kind\s*:/.test(content);
  if (!isKubernetesManifest) {
    return null;
  }

  for (const line of content.split('\n')) {
    const match = /^\s*-?\s*image:\s*'?"?([^\s'"]+)'?"?\s*$/.exec(line);
    if (match) {
      const currentFrom = match[1];
      const dep = getDep(currentFrom);
      logger.debug(
        {
          depName: dep.depName,
          currentValue: dep.currentValue,
          currentDigest: dep.currentDigest,
        },
        'Kubernetes image'
      );
      deps.push(dep);
    }
  }
  deps = deps.filter((dep) => !dep.currentValue?.includes('${'));
  if (!deps.length) {
    return null;
  }
  return { deps };
}
