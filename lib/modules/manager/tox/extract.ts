// based on https://www.python.org/dev/peps/pep-0508/#names
import { RANGE_PATTERN } from '@renovatebot/pep440';
import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import { PypiDatasource } from '../../datasource/pypi';
import type { PackageDependency, PackageFile, Result } from '../types';

function getSectionName(str: string): string | null {
  const result = regEx(/^\s*\[\s*(?<sectionName>\S+)\s*]\s*$/).exec(str);
  return result?.groups?.sectionName ?? null;
}

/**
 * Get the name of the parameter
 * Do not allow starting with spaces, this is how deps arrays are declared,
 * by indent
 */
function getParamName(str: string): string | null {
  const result = regEx(/^(?<paramName>[\w.\-_]+)\s*=\s*.*?\s*$/).exec(str);
  return result?.groups?.paramName ?? null;
}

/**
 * Taken from the setup.cfg manager due to some edits to the dep type.
 */
function parseDep(line: string): PackageDependency | null {
  const packagePattern = '[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]';
  const extrasPattern = '(?:\\s*\\[[^\\]]+\\])?';

  const rangePattern: string = RANGE_PATTERN;
  const specifierPartPattern = `\\s*${rangePattern.replace(
    regEx(/\?<\w+>/g),
    '?:'
  )}`;
  const specifierPattern = `${specifierPartPattern}(?:\\s*,${specifierPartPattern})*`;
  const dependencyPattern = `(${packagePattern})(${extrasPattern})(${specifierPattern})`;

  const pkgRegex = regEx(`^(${packagePattern})$`);
  const pkgValRegex = regEx(`^${dependencyPattern}$`);

  const [lineNoEnvMarkers] = line.split(';').map((part) => part.trim());
  const packageMatches =
    pkgValRegex.exec(lineNoEnvMarkers) ?? pkgRegex.exec(lineNoEnvMarkers);

  if (!packageMatches) {
    return null;
  }

  const [, depName, , currVal] = packageMatches;
  const currentValue = currVal?.trim();

  const dep: PackageDependency = {
    depName,
    currentValue,
    datasource: PypiDatasource.id,
    depType: 'test',
  };

  if (currentValue?.startsWith('==')) {
    dep.currentVersion = currentValue.replace(/^==\s*/, '');
  }

  return dep;
}

/**
 * Map over the lines keeping track if the section is a test env
 * and the parameter is deps =
 *
 * It is only valid to have a single dep with
 *
 * deps = <dep>
 *
 * or deps with indents like so
 *
 * deps =
 *     dep1
 *     dep2
 *
 * Attempting to use use npm ini does not parse deps arrays correctly.
 */
export function extractPackageFile(
  content: string
): Result<PackageFile | null> {
  logger.trace('tox.extractPackageFile()');

  let sectionName: string | null = null;
  let paramName: string | null = null;
  let inDeps = false;
  let isTestEnv = false;

  const deps: PackageDependency[] = [];
  const testEnvRegex = regEx(/^(testenv)\S*\s*$/);

  content
    .split(newlineRegex)
    .filter( line => !regEx(/#.*$/).test(line))
    .forEach((rawLine) => {
      let line = rawLine;
      const newSectionName = getSectionName(line);

      // Keep track of when sections change
      if (newSectionName) {
        sectionName = newSectionName;
        isTestEnv = testEnvRegex.test(sectionName);
        inDeps = false;
        return;
      }

      // Only parse if inside testenv and param name is deps =
      const depsReplaceRegex = regEx(/^deps\s*=\s*/);
      if (isTestEnv) {
        paramName = getParamName(line);
        if (paramName === 'deps') {
          inDeps = true;
          // Can also have deps on this line, so just remove the preceeding
          // deps =
          line = line.replace(depsReplaceRegex, '');
        } else if (paramName !== 'deps') {
          inDeps = false;
          return;
        }
      }

      if (inDeps) {
        const dep = parseDep(line);
        if (dep) {
          deps.push(dep);
        }
      }
    });

  return deps.length ? { deps } : null;
}
