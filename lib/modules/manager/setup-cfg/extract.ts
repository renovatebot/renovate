import { logger } from '../../../logger/index.ts';
import type { MaybePromise } from '../../../types/index.ts';
import { coerceArray } from '../../../util/array.ts';
import {
  extrasPattern,
  packagePattern,
  pypiDependency,
  specifierPattern,
} from '../../../util/pep508.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

// `setup.cfg` requires a version specifier for the name/extras form, so it
// does not reuse the shared `dependencyPattern`.
const dependencyPattern = `(${packagePattern})(${extrasPattern})(${specifierPattern})`;
const pkgRegex = regEx(`^(${packagePattern})$`);
const pkgValRegex = regEx(`^${dependencyPattern}$`);

function getSectionName(str: string): string {
  const [, sectionName] = coerceArray(
    regEx(/^\[\s*(?<sectionName>[^\s]+)\s*]\s*$/).exec(str),
  );
  return sectionName;
}

function getSectionRecord(str: string): string {
  const [, sectionRecord] = coerceArray(
    regEx(/^(?<sectionRecord>[^\s]+)\s*=/).exec(str),
  );
  return sectionRecord;
}

function getDepType(
  section: string | null,
  record: string | null,
): null | string {
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
  return null;
}

function parseDep(
  line: string,
  section: string | null,
  record: string | null,
): PackageDependency | null {
  const depType = getDepType(section, record);
  if (!depType) {
    return null;
  }

  const [lineNoEnvMarkers] = line.split(';').map((part) => part.trim());
  const packageMatches =
    pkgValRegex.exec(lineNoEnvMarkers) ?? pkgRegex.exec(lineNoEnvMarkers);

  if (!packageMatches) {
    return null;
  }

  const [, depName, , currVal] = packageMatches;
  return pypiDependency(depName, currVal?.trim(), depType);
}

export function extractPackageFile(
  content: string,
): MaybePromise<PackageFileContent | null> {
  logger.trace('setup-cfg.extractPackageFile()');

  let sectionName: string | null = null;
  let sectionRecord: string | null = null;

  const deps: PackageDependency[] = [];

  content
    .split(newlineRegex)
    .map((line) => line.replace(regEx(/#.*$/), '').trimEnd())
    .forEach((rawLine) => {
      let line = rawLine;
      const newSectionName = getSectionName(line);
      const newSectionRecord = getSectionRecord(line);
      if (newSectionName) {
        sectionName = newSectionName;
      }
      if (newSectionRecord) {
        sectionRecord = newSectionRecord;
        // Probably there are also requirements in this line.
        line = rawLine.replace(regEx(/^[^=]*=\s*/), '');
        line.split(';').forEach((part) => {
          const dep = parseDep(part, sectionName, sectionRecord);
          if (dep) {
            deps.push(dep);
          }
        });
        return;
      }

      const dep = parseDep(line, sectionName, sectionRecord);
      if (dep) {
        deps.push(dep);
      }
    });

  return deps.length ? { deps } : null;
}
