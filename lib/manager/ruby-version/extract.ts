import * as datasourceRubyVersion from '../../datasource/ruby-version';
import { logger } from '../../logger';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile {
  logger.trace('ruby-version.extractPackageFile()');
  const dep: PackageDependency = {
    depName: 'ruby',
    currentValue: content.trim(),
    datasource: datasourceRubyVersion.id,
  };
  return { deps: [dep] };
}
