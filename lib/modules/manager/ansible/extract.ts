import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import * as dockerVersioning from '../../versioning/docker';
import { getDep } from '../dockerfile/extract';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageFileContent | null {
  logger.trace(`ansible.extractPackageFile(${packageFile})`);
  let deps: PackageDependency[] = [];
  const re = regEx(/^\s*image:\s*'?"?([^\s'"]+)'?"?\s*$/);
  for (const line of content.split(newlineRegex)) {
    const match = re.exec(line);
    if (match) {
      const currentFrom = match[1];
      const dep = getDep(currentFrom, true, config.registryAliases);
      logger.debug(
        {
          depName: dep.depName,
          currentValue: dep.currentValue,
          currentDigest: dep.currentDigest,
        },
        'Docker image inside ansible',
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
