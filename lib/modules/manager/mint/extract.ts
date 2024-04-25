import { newlineRegex } from '../../../util/regex';
import { GitTagsDatasource } from '../../datasource/git-tags';
import type { PackageDependency, PackageFileContent } from '../types';

export function extractPackageFile(content: string): PackageFileContent | null {
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
      skipReason: 'unspecified-version',
    };
  }
  const [depName, currentVersion] = line.split('@').map((s) => s.trim());
  return {
    depName,
    currentValue: currentVersion,
    datasource: GitTagsDatasource.id,
    packageName: `https://github.com/${depName}.git`,
  };
}
