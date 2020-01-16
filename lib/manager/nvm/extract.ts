import { isValid } from '../../versioning/node';
import { PackageFile, PackageDependency } from '../common';
import { DATASOURCE_GITHUB } from '../../constants/data-binary-source';

export function extractPackageFile(content: string): PackageFile {
  const dep: PackageDependency = {
    depName: 'node',
    currentValue: content.trim(),
    datasource: DATASOURCE_GITHUB,
    lookupName: 'nodejs/node',
  };
  if (!isValid(dep.currentValue)) {
    dep.skipReason = 'unsupported-version';
  }
  return { deps: [dep] };
}
