import { logger } from '../../logger';
import { isVersion } from '../../versioning/semver';
import { PackageFile, PackageDependency } from '../common';

export { extractPackageFile };

function extractPackageFile(content: string): PackageFile {
  const deps: PackageDependency[] = [];
  try {
    const lines = content.split('\n');
    let isPluginsSection = false;
    let pluginsIndent = '';
    for (let lineNumber = 1; lineNumber <= lines.length; lineNumber += 1) {
      const lineIdx = lineNumber - 1;
      const line = lines[lineIdx];
      const pluginsSection = line.match(
        /^(?<pluginsIndent>\s*)(-?\s*)plugins:/
      );
      if (pluginsSection) {
        logger.trace(`Matched plugins on line ${lineNumber}`);
        isPluginsSection = true;
        pluginsIndent = pluginsSection.groups.pluginsIndent;
      } else if (isPluginsSection) {
        logger.debug(`serviceImageLine: "${line}"`);
        const depLineMatch = line.match(
          /^(?<currentIndent>\s+)(?:-\s+)?(?<depName>[^#]+)#(?<currentValue>[^:]+):/
        );
        if (depLineMatch) {
          const { currentIndent, depName, currentValue } = depLineMatch.groups;
          if (currentIndent.length <= pluginsIndent.length) {
            isPluginsSection = false;
            pluginsIndent = '';
          } else {
            logger.trace('depLineMatch');
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
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error extracting buildkite plugins');
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
