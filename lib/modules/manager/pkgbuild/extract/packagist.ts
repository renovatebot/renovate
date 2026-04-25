import { isNonEmptyString } from '@sindresorhus/is';
import { regEx } from '../../../../util/regex.ts';
import { PackagistDatasource } from '../../../datasource/packagist/index.ts';
import type { SourceData } from '../types.ts';

/**
 * Parse Packagist URLs
 * Example: https://packagist.org/packages/vendor/package
 */
export function parsePackagistUrl(
  parsedUrl: URL,
  expandedUrl: string,
): SourceData | null {
  const pathParts = parsedUrl.pathname.split('/').filter(isNonEmptyString);

  // Look for vendor/package pattern in URL or filename
  if (pathParts.length >= 3 && pathParts[0] === 'packages') {
    const vendor = pathParts[1];
    const packageName = pathParts[2];

    // Version not present in this URL format; let Renovate fetch it via datasource
    return {
      url: expandedUrl,
      owner: vendor,
      repo: packageName,
      datasource: PackagistDatasource.id,
    };
  }

  // Try to parse from download URL with filename
  const filename = pathParts[pathParts.length - 1];
  if (filename) {
    const packagistRegex = regEx(/^(.+?)-([\d.]+.*?)\.(tar\.gz|zip)$/);
    const match = packagistRegex.exec(filename);
    if (match) {
      const packageName = match[1];
      const version = match[2];

      return {
        url: expandedUrl,
        version,
        owner: packageName,
        repo: packageName,
        datasource: PackagistDatasource.id,
      };
    }
  }

  return null;
}
