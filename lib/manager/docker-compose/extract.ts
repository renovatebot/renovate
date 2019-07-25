import { logger } from '../../logger';
import { getDep } from '../dockerfile/extract';
import { PackageFile, PackageDependency } from '../common';

export function extractPackageFile(content: string): PackageFile {
  logger.debug('docker-compose.extractPackageFile()');
  let deps: PackageDependency[] = [];
  let lineNumber = 0;
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*image:\s*'?"?([^\s'"]+)'?"?\s*$/);
    if (match) {
      const currentFrom = match[1];
      const dep = getDep(currentFrom);
      logger.trace(
        {
          depName: dep.depName,
          currentValue: dep.currentValue,
          currentDigest: dep.currentDigest,
        },
        'Docker Compose image'
      );
      dep.managerData = { lineNumber };
      deps.push(dep);
    }
    lineNumber += 1;
  }
  deps = deps.filter(
    dep => !(dep.currentValue && dep.currentValue.includes('${'))
  );
  if (!deps.length) {
    return null;
  }
  return { deps };
}
