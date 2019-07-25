import { logger } from '../../logger';
import { isVersion } from '../../versioning/semver';
import { PackageFile, PackageDependency } from '../common';

export { extractPackageFile };

function extractPackageFile(content: string): PackageFile {
  const deps: PackageDependency[] = [];
  try {
    const lines = content.split('\n');
    let pluginsSection = null;
    let pluginsIndent = '';
    for (let lineNumber = 1; lineNumber <= lines.length; lineNumber += 1) {
      const lineIdx = lineNumber - 1;
      const line = lines[lineIdx];
      const plugins = line.match(/^(\s*-?\s*)plugins:/);
      if (plugins) {
        logger.trace(`Matched plugins on line ${lineNumber}`);
        [pluginsSection, pluginsIndent] = plugins;
      } else if (pluginsSection) {
        logger.debug(`serviceImageLine: "${line}"`);
        const depLineMatch = line.match(/^\s+(?:-\s+)?([^#]+)#([^:]+):/);
        const [, currentIndent] = line.match(/^(\s*)/);
        if (currentIndent.length <= pluginsIndent.length) {
          pluginsSection = null;
          pluginsIndent = '';
        } else if (depLineMatch) {
          logger.trace('depLineMatch');
          const [, depName, currentValue] = depLineMatch;
          let skipReason: string;
          let repo: string;
          if (depName.startsWith('https://') || depName.startsWith('git@')) {
            logger.debug({ dependency: depName }, 'Skipping git plugin');
            skipReason = 'git-plugin';
          } else if (!isVersion(currentValue)) {
            logger.debug(
              { currentValue },
              'Skipping non-pinned current version'
            );
            skipReason = 'invalid-version';
          } else {
            const splitName = depName.split('/');
            if (splitName.length === 1) {
              repo = `buildkite-plugins/${depName}-buildkite-plugin`;
            } else if (splitName.length === 2) {
              repo = `${depName}-buildkite-plugin`;
            } else {
              logger.warn(
                { dependency: depName },
                'Something is wrong with buildkite plugin name'
              );
              skipReason = 'unknown';
            }
          }
          const dep: PackageDependency = {
            managerData: { lineNumber },
            depName,
            currentValue,
            skipReason,
          };
          if (repo) {
            dep.datasource = 'github';
            dep.lookupName = repo;
          }
          deps.push(dep);
        }
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error extracting buildkite plugins');
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
