import { logger } from '../../logger';
import { getDep } from '../dockerfile/extract';
import {
  PackageFile,
  PackageDependency,
  ExtractPackageFileConfig,
} from '../common';
import { VERSION_SCHEME_DOCKER } from '../../constants/version-schemes';

export default function extractPackageFile({
  fileContent,
}: ExtractPackageFileConfig): PackageFile | null {
  logger.trace('ansible.extractPackageFile()');
  let deps: PackageDependency[] = [];
  let lineNumber = 0;
  const re = /^\s*image:\s*'?"?([^\s'"]+)'?"?\s*$/;
  for (const line of fileContent.split('\n')) {
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
      dep.managerData = { lineNumber };
      dep.versionScheme = VERSION_SCHEME_DOCKER;
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
