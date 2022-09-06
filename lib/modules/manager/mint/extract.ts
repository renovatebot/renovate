import { newlineRegex } from '../../../util/regex';
import { GitTagsDatasource } from '../../datasource/git-tags';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile | null {
  const deps: PackageDependency[] = [];

  for (const line of content.split(newlineRegex).map((s) => s.trim())) {
    if (line === '') {
      continue;
    }

    // commented out line
    if (line.startsWith('#')) {
      continue;
    }

    // commented out line after package name
    if (line.includes('#')) {
      const [uncommentLine] = line.split('#');
      deps.push(handleDepInMintfile(uncommentLine));
      continue;
    }

    deps.push(handleDepInMintfile(line));
  }
  return deps.length ? { deps } : null;
}

function handleDepInMintfile(line: string): PackageDependency {
  if (!line.includes('@')) {
    return {
      depName: line,
      skipReason: 'no-version',
    };
  }
  const [depName, currentVersion] = line.split('@').map((s) => s.trim());
  return {
    depName: depName,
    currentValue: currentVersion,
    datasource: GitTagsDatasource.id,
    packageName: `https://github.com/${depName}.git`,
  };
}
