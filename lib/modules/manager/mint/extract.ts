import { newlineRegex } from '../../../util/regex.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

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
  const [depDefinition, currentVersion] = line.split('@').map((s) => s.trim());
  let depName = depDefinition;
  let packageName = `https://github.com/${depName}.git`;

  if (
    depDefinition.startsWith('http://') ||
    depDefinition.startsWith('https://')
  ) {
    packageName = depDefinition.endsWith('.git')
      ? depDefinition
      : `${depDefinition}.git`;
    depName = packageName.replace('.git', '').split('/').slice(-2).join('/');
  }

  return {
    depName,
    currentValue: currentVersion,
    datasource: GitTagsDatasource.id,
    packageName,
  };
}
