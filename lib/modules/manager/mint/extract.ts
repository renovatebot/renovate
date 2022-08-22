import { GitTagsDatasource } from '../../datasource/git-tags';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile | null {
  const deps: PackageDependency[] = [];

  content.split('\n').forEach((line) => {
    if (line.includes('@')) {
      const [depName, currentVersion] = line.replace(/\s+/g, '').split('@');
      const dep: PackageDependency = {
        depName: depName,
        currentValue: currentVersion,
        datasource: GitTagsDatasource.id,
        packageName: `https://github.com/${depName}.git`,
      };
      deps.push(dep);
    }
  });
  return deps.length ? { deps } : null;
}
