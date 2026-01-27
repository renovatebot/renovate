import { isNonEmptyString } from '@sindresorhus/is';
import { regEx } from '../../../../util/regex.ts';
import { NpmDatasource } from '../../../datasource/npm/index.ts';
import type { SourceData } from '../types.ts';

/**
 * Parse npm registry URLs
 * Example: https://registry.npmjs.org/packagename/-/packagename-1.0.0.tgz
 * Example: https://registry.npmjs.org/@scope/packagename/-/packagename-1.0.0.tgz
 */
export function parseNpmUrl(
  parsedUrl: URL,
  expandedUrl: string,
): SourceData | null {
  const pathParts = parsedUrl.pathname.split('/').filter(isNonEmptyString);

  if (pathParts.length < 2) {
    return null;
  }

  // Handle scoped packages: @scope/package/-/package-1.0.0.tgz
  let packageName: string;
  let filenameIndex: number;

  if (pathParts[0].startsWith('@')) {
    // Scoped package
    packageName = `${pathParts[0]}/${pathParts[1]}`;
    filenameIndex = 3;
  } else {
    // Regular package
    packageName = pathParts[0];
    filenameIndex = 2;
  }

  if (pathParts.length <= filenameIndex) {
    return null;
  }

  // Extract version from filename
  const filename = pathParts[filenameIndex];
  const npmRegex = regEx(/-([\d.]+.*?)\.tgz$/);
  const match = npmRegex.exec(filename);
  if (!match) {
    return null;
  }

  const version = match[1];

  return {
    url: expandedUrl,
    version,
    datasource: NpmDatasource.id,
    packageName,
  };
}
