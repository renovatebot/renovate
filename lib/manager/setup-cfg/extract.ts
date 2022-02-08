// based on https://www.python.org/dev/peps/pep-0508/#names
import { RANGE_PATTERN } from '@renovatebot/pep440';
import { PypiDatasource } from '../../datasource/pypi';
import { logger } from '../../logger';
import { newlineRegex, regEx } from '../../util/regex';
import type { PackageDependency, PackageFile } from '../types';

function getSectionName(str: string): string {
  const [, sectionName] = regEx(/^\[\s*([^\s]+)\s*]\s*$/).exec(str) || [];
  return sectionName;
}

function getSectionRecord(str: string): string {
  const [, sectionRecord] = regEx(/^([^\s]+)\s+=/).exec(str) || [];
  return sectionRecord;
}

function getDepType(section: string, record: string): null | string {
  if (section === 'options') {
    if (record === 'install_requires') {
      return 'install';
    }
    if (record === 'setup_requires') {
      return 'setup';
    }
    if (record === 'tests_require') {
      return 'test';
    }
  }
  if (section === 'options.extras_require') {
    return 'extra';
  }
  return undefined;
}

export const packagePattern =
  '[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]';
const extrasPattern = '(?:\\s*\\[[^\\]]+\\])?';

const rangePattern: string = RANGE_PATTERN;
const specifierPartPattern = `\\s*${rangePattern.replace(
  regEx(/\?<\w+>/g),
  '?:'
)}`;
const specifierPattern = `${specifierPartPattern}(?:\\s*,${specifierPartPattern})*`;
export const dependencyPattern = `(${packagePattern})(${extrasPattern})(${specifierPattern})`;

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace('setup-cfg.extractPackageFile()');

  let sectionName = null;
  let sectionRecord = null;

  const pkgRegex = regEx(`^(${packagePattern})$`);
  const pkgValRegex = regEx(`^${dependencyPattern}$`);

  const deps = content
    .split(newlineRegex)
    .map((rawLine) => {
      let dep: PackageDependency = {};
      let line = rawLine;
      const newSectionName = getSectionName(line);
      const newSectionRecord = getSectionRecord(line);
      if (newSectionName) {
        sectionName = newSectionName;
      }
      if (newSectionRecord) {
        sectionRecord = newSectionRecord;
        // Propably there are also requirements in this line. Strip the sectionRecord.
        line = rawLine.replace(regEx(/^[^=]*=\s*/), '\t');
      }

      const [lineNoEnvMarkers] = line.split(';').map((part) => part.trim());
      const packageMatches =
        pkgValRegex.exec(lineNoEnvMarkers) || pkgRegex.exec(lineNoEnvMarkers);

      if (!packageMatches) {
        return null;
      }

      const depType = getDepType(sectionName, sectionRecord);
      if (!depType) {
        return null;
      }

      const [, depName, , currVal] = packageMatches;
      const currentValue = currVal?.trim();

      dep = {
        ...dep,
        depName,
        currentValue,
        datasource: PypiDatasource.id,
        depType: depType,
      };

      if (currentValue?.startsWith('==')) {
        dep.currentVersion = currentValue.replace(/^==\s*/, '');
      }

      return dep;
    })
    .filter(Boolean);

  return deps.length ? { deps } : null;
}
