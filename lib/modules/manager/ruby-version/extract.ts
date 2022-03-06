import { logger } from '../../../logger';
import { RubyVersionDatasource } from '../../datasource/ruby-version';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile {
  logger.trace('ruby-version.extractPackageFile()');
  const dep: PackageDependency = {
    depName: 'ruby',
    currentValue: content.trim(),
    datasource: RubyVersionDatasource.id,
  };
  return { deps: [dep] };
}
