import is from '@sindresorhus/is';
import { regEx } from '../../../../util/regex.ts';
import { PypiDatasource } from '../../../datasource/pypi/index.ts';
import type { SourceData } from '../types.ts';

/**
 * Parse PyPI URLs
 * Example: https://files.pythonhosted.org/packages/.../packagename-1.0.0.tar.gz
 */
export function parsePyPIUrl(
  parsedUrl: URL,
  expandedUrl: string,
): SourceData | null {
  const pathParts = parsedUrl.pathname.split('/').filter(is.nonEmptyString);

  // Extract filename from URL
  const filename = pathParts[pathParts.length - 1];
  if (!filename) {
    return null;
  }

  // Match pattern: packagename-version.tar.gz or similar
  const pypiRegex = regEx(/^(.+?)-([\d.]+.*?)\.(tar\.gz|tar\.bz2|zip)$/);
  const match = pypiRegex.exec(filename);
  if (!match) {
    return null;
  }

  const packageName = match[1];
  const version = match[2];

  return {
    url: expandedUrl,
    version,
    datasource: PypiDatasource.id,
    packageName,
  };
}
