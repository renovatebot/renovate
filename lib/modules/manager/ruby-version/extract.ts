import { logger } from '../../../logger/index.ts';
import { RubyVersionDatasource } from '../../datasource/ruby-version/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

export function extractPackageFile(content: string): PackageFileContent {
  logger.trace('ruby-version.extractPackageFile()');
  const dep: PackageDependency = {
    depName: 'ruby',
    currentValue: content.trim(),
    datasource: RubyVersionDatasource.id,
  };
  return { deps: [dep] };
}
