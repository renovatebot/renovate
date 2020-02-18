import { PackageFile, PackageDependency } from '../common';
import { DATASOURCE_CDNJS } from '../../constants/data-binary-source';

export const cloudflareUrlRegex = /\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/(?<depName>[^/]+?)\/(?<currentValue>[^/]+?)\/(?<asset>[-/_.a-zA-Z0-9]+)/;

export function extractPackageFile(content: string): PackageFile {
  const deps: PackageDependency[] = [];

  let rest = content;
  let match = cloudflareUrlRegex.exec(rest);
  let offset = 0;
  while (match) {
    const [wholeSubstr] = match;
    const { depName, currentValue, asset } = match.groups;

    const fileReplacePosition =
      offset + match.index + wholeSubstr.indexOf(currentValue);

    offset += match.index + wholeSubstr.length;
    rest = content.slice(offset);
    match = cloudflareUrlRegex.exec(rest);

    deps.push({
      datasource: DATASOURCE_CDNJS,
      depName,
      lookupName: `${depName}/${asset}`,
      currentValue,
      managerData: {
        fileReplacePosition,
      },
    });
  }

  return { deps };
}
