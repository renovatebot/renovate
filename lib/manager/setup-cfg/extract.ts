import { id as datasource } from '../../datasource/pypi';
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
    return { datasource, depName, currentValue };
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
        let dep: PackageDependency;
        if (newSectionRecord) {
          sectionRecord = newSectionRecord;
          line = rawLine.replace(/^[^=]*=\s*/, '');
        }
        if (
          sectionName === 'options' &&
          ['setup_requires', 'install_requires', 'tests_require'].includes(
            sectionRecord
          )
        ) {
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
