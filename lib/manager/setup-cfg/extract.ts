import { id as datasource } from '../../datasource/pypi';
import pep440 from '../../versioning/pep440';
import type { PackageDependency, PackageFile, Result } from '../types';

function getSectionName(str: string): string {
  const [, sectionName] = /^\[\s*([^\s]+)\s*]\s*$/.exec(str) || [];
  return sectionName;
}

function getSectionRecord(str: string): string {
  const [, sectionRecord] = /^([^\s]+)\s+=/.exec(str) || [];
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
  return 'extra';
}

function parseDep(
  line: string,
  section: string,
  record: string
): PackageDependency | null {
  const [, depName, currentValue] =
    /\s+([-_a-zA-Z0-9]*)\s*(.*)/.exec(line) || [];
  if (
    section &&
    record &&
    depName &&
    currentValue &&
    pep440.isValid(currentValue)
  ) {
    const dep: PackageDependency = { datasource, depName, currentValue };
    const depType = getDepType(section, record);
    if (depType) {
      dep.depType = depType;
    }
    return dep;
  }
  return null;
}

export function extractPackageFile(
  content: string
): Result<PackageFile | null> {
  let sectionName = null;
  let sectionRecord = null;

  const deps: PackageDependency[] = [];
  content
    .split('\n')
    .map((line) => line.replace(/[;#].*$/, '').trimRight())
    .forEach((rawLine) => {
      let line = rawLine;
      const newSectionName = getSectionName(line);
      const newSectionRecord = getSectionRecord(line);
      if (newSectionName) {
        sectionName = newSectionName;
      } else {
        if (newSectionRecord) {
          sectionRecord = newSectionRecord;
          line = rawLine.replace(/^[^=]*=\s*/, '\t');
        }
        const dep = parseDep(line, sectionName, sectionRecord);
        if (dep) {
          deps.push(dep);
        }
      }
    });

  return deps.length > 0 ? { deps } : null;
}
