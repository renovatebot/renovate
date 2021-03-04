import { logger } from '../../logger';
import * as dockerVersioning from '../../versioning/docker';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';

export default function extractPackageFile(
  content: string
): PackageFile | null {
  logger.trace('ansible.extractPackageFile()');
  let deps: PackageDependency[] = [];
  const re = /^\s*image:\s*'?"?([^\s'"]+)'?"?\s*$/;
  for (const line of content.split('\n')) {
    const match = re.exec(line);
    if (match) {
      const currentFrom = match[1];
      const dep = getDep(currentFrom);
      logger.debug(
        {
          depName: dep.depName,
          currentValue: dep.currentValue,
          currentDigest: dep.currentDigest,
        },
        'Docker image inside ansible'
      );
      dep.versioning = dockerVersioning.id;
      deps.push(dep);
    }
  }
  deps = deps.filter((dep) => !dep.currentValue?.includes('${'));
  if (!deps.length) {
    return null;
  }
  return { deps };
}
