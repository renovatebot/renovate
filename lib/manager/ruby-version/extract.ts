import { logger } from '../../logger';
import { PackageDependency, PackageFile } from '../common';
import * as datasourceRubyVersion from '../../datasource/ruby-version';

export function extractPackageFile(content: string): PackageFile {
  logger.trace('ruby-version.extractPackageFile()');
  const dep: PackageDependency = {
    depName: 'ruby',
    currentValue: content.trim(),
    datasource: datasourceRubyVersion.id,
  };
  return { deps: [dep] };
}
