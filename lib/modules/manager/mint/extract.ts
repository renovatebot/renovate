import { GitTagsDatasource } from '../../datasource/git-tags';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile | null {
  const deps: PackageDependency[] = [];

  content.split('\n').forEach((line) => {
    if (line === '') {
      return;
    }

    // commented out line
    if (line.startsWith('#')) {
      return;
    }

    // exclude blanks
    const noBlanksLine = line.replace(/\s+/g, '');
    if (noBlanksLine === '') {
      return;
    }

    // commented out line after package name
    if (noBlanksLine.includes('#')) {
      const [uncommentLine] = line.split('#');
      deps.push(handleDepInMintfile(uncommentLine));
      return;
    }

    deps.push(handleDepInMintfile(noBlanksLine));
    return;
  });
  return deps.length ? { deps } : null;
}

function handleDepInMintfile(line: string): PackageDependency {
  if (!line.includes('@')) {
    return {
      depName: line,
      currentValue: null,
      skipReason: 'no-version',
      packageName: `https://github.com/${line}.git`,
    };
  }
  const [depName, currentVersion] = line.split('@');
  return {
    depName: depName,
    currentValue: currentVersion,
    datasource: GitTagsDatasource.id,
    packageName: `https://github.com/${depName}.git`,
  };
}
