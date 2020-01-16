import { isValid } from '../../versioning/ruby';
import { logger } from '../../logger';
import {
  ExtractPackageFileConfig,
  PackageDependency,
  PackageFile,
} from '../common';
import { DATASOURCE_RUBY_VERSION } from '../../constants/data-binary-source';

export function extractPackageFile({
  fileContent,
}: ExtractPackageFileConfig): PackageFile {
  logger.trace('ruby-version.extractPackageFile()');
  const dep: PackageDependency = {
    depName: 'ruby',
    currentValue: fileContent.trim(),
    datasource: DATASOURCE_RUBY_VERSION,
  };
  if (!isValid(dep.currentValue)) {
    dep.skipReason = 'unsupported-version';
  }
  return { deps: [dep] };
}
