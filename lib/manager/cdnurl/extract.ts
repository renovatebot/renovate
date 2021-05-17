import * as datasourceCdnjs from '../../datasource/cdnjs';
import type { PackageDependency, PackageFile } from '../types';

export const cloudflareUrlRegex = /\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/(?<depName>[^/]+?)\/(?<currentValue>[^/]+?)\/(?<asset>[-/_.a-zA-Z0-9]+)/;

export function extractPackageFile(content: string): PackageFile {
  const deps: PackageDependency[] = [];

  let rest = content;
  let match = cloudflareUrlRegex.exec(rest);
  let offset = 0;
  while (match) {
    const [wholeSubstr] = match;
    const { depName, currentValue, asset } = match.groups;
    offset += match.index + wholeSubstr.length;
    rest = content.slice(offset);
    match = cloudflareUrlRegex.exec(rest);

    deps.push({
      datasource: datasourceCdnjs.id,
      depName,
      lookupName: `${depName}/${asset}`,
      currentValue,
    });
  }

  return { deps };
}
