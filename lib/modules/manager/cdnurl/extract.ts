import { regEx } from '../../../util/regex';
import { CdnJsDatasource } from '../../datasource/cdnjs';
import type { PackageDependency, PackageFileContent } from '../types';

export const cloudflareUrlRegex = regEx(
  /\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/(?<depName>[^/]+?)\/(?<currentValue>[^/]+?)\/(?<asset>[-/_.a-zA-Z0-9]+)/,
);

export function extractPackageFile(content: string): PackageFileContent {
  const deps: PackageDependency[] = [];

  let rest = content;
  let match = cloudflareUrlRegex.exec(rest);
  let offset = 0;
  while (match?.groups) {
    const [wholeSubstr] = match;
    const { depName, currentValue, asset } = match.groups;
    offset += match.index + wholeSubstr.length;
    rest = content.slice(offset);
    match = cloudflareUrlRegex.exec(rest);

    deps.push({
      datasource: CdnJsDatasource.id,
      depName,
      packageName: `${depName}/${asset}`,
      currentValue,
    });
  }

  return { deps };
}
