import { isValid } from '../../versioning/ruby';
import { logger } from '../../logger';
import {
  ExtractPackageFileConfig,
  PackageDependency,
  PackageFile,
} from '../common';

export function extractPackageFile({
  content,
}: ExtractPackageFileConfig): PackageFile {
  logger.trace('ruby-version.extractPackageFile()');
  const dep: PackageDependency = {
    depName: 'ruby',
    currentValue: content.trim(),
    datasource: 'rubyVersion',
  };
  if (!isValid(dep.currentValue)) {
    dep.skipReason = 'unsupported-version';
  }
  return { deps: [dep] };
}
