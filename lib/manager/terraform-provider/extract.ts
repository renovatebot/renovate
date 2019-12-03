import { logger } from '../../logger';
import { isValid } from '../../versioning/hashicorp';
import { PackageDependency, PackageFile } from '../common';

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace({ content }, 'terraform-provider.extractPackageFile()');
  if (!content.includes('provider "')) {
    return null;
  }
  const deps: PackageDependency[] = [];
  try {
    const lines = content.split('\n');
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      let line = lines[lineNumber];
      const providerDefinition = line.match(/^provider\s+"([^"]+)"\s+{\s*$/);
      if (providerDefinition) {
        logger.trace(`Matched provider on line ${lineNumber}`);
        const dep: PackageDependency = {
          moduleName: providerDefinition[1],
          managerData: {},
        };
        do {
          lineNumber += 1;
          line = lines[lineNumber];
          const kvMatch = line.match(/^\s*([^\s]+)\s+=\s+"([^"]+)"\s*$/);
          if (kvMatch) {
            const [, key, value] = kvMatch;
            if (key === 'version') {
              dep.currentValue = value;
              dep.versionLine = lineNumber;
              break;
            }
          }
        } while (line.trim() !== '}');
        deps.push(dep);
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error extracting buildkite plugins');
  }
  deps.forEach(dep => {
    /* eslint-disable no-param-reassign */
    dep.depType = 'terraform';
    dep.depName = dep.moduleName;
    dep.depNameShort = dep.moduleName;
    dep.managerData.lineNumber = dep.versionLine;
    dep.datasource = 'terraformProvider';
    if (dep.managerData.lineNumber) {
      if (!isValid(dep.currentValue)) {
        dep.skipReason = 'unsupported-version';
      }
    } else if (!dep.skipReason) {
      dep.skipReason = 'no-version';
    }

    delete dep.versionLine;
    /* eslint-enable no-param-reassign */
  });
  return { deps };
}
