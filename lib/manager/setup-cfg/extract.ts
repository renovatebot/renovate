import { id as datasource } from '../../datasource/pypi';
import { SkipReason } from '../../types';
import pep440 from '../../versioning/pep440';
import { PackageDependency, PackageFile, Result } from '../common';

function getSectionName(str: string): string {
  const [, sectionName] = /^\[\s*([^\s]+)\s*]\s*$/.exec(str) || [];
  return sectionName;
}

function getSectionRecord(str: string): string {
  const [, sectionRecord] = /^([^\s]+)\s+=/.exec(str) || [];
  return sectionRecord;
}

function parseDep(line: string): PackageDependency | null {
  const [, depName, currentValue] = /\s*([^\s=~<>!]*)\s*(.*)/.exec(line) || [];
  if (depName && currentValue) {
    const dep: PackageDependency = { datasource, depName, currentValue };
    if (!pep440.isValid(currentValue)) {
      dep.skipReason = SkipReason.UnsupportedValue;
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
    .map((line) => line.replace(/;.*$/, '').trimRight())
    .forEach((rawLine) => {
      let line = rawLine;
      const newSectionName = getSectionName(line);
      const newSectionRecord = getSectionRecord(line);
      if (newSectionName) {
        sectionName = newSectionName;
      } else {
        let dep: PackageDependency;
        if (newSectionRecord) {
          sectionRecord = newSectionRecord;
          line = rawLine.replace(/^[^=]*=\s*/, '');
        }
        if (sectionName === 'options' && sectionRecord === 'install_requires') {
          dep = parseDep(line);
        } else if (
          sectionName === 'options.extras_require' &&
          ['test', 'doc', 'dev'].includes(sectionRecord)
        ) {
          const extraDep = parseDep(line);
          if (extraDep) {
            dep = { ...extraDep, depType: sectionRecord };
          }
        }
        if (dep) {
          deps.push(dep);
        }
      }
    });

  return deps.length > 0 ? { deps } : null;
}
