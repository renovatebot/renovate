import { isValid } from '../../versioning/node';
import { PackageFile, PackageDependency } from '../common';

export function extractPackageFile(content: string): PackageFile {
  const dep: PackageDependency = {
    depName: 'node',
    currentValue: content.trim(),
    datasource: 'github',
    lookupName: 'nodejs/node',
  };
  if (!isValid(dep.currentValue)) {
    dep.skipReason = 'unsupported-version';
  }
  return { deps: [dep] };
}
