import { PackageFile, PackageDependency } from '../common';
import { DATASOURCE_CDNJS } from '../../constants/data-binary-source';

export function extractPackageFile(content: string): PackageFile {
  const deps: PackageDependency[] = [];

  const regex = /\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/(?<depName>[^/]+?)\/(?<currentValue>[^/]+?)\/(?<asset>[-_.a-zA-Z0-9]+)/;
  let rest = content;
  let match = rest.match(regex);
  let offset = 0;
  while (match) {
    const [wholeSubstr] = match;
    const { depName, currentValue, asset } = match.groups;

    const fileReplacePosition =
      offset + match.index + wholeSubstr.indexOf(currentValue);

    offset += match.index + wholeSubstr.length;
    rest = content.slice(offset);
    match = rest.match(regex);

    deps.push({
      datasource: DATASOURCE_CDNJS,
      depName,
      lookupName: `${depName}/${asset}`,
      currentValue,
      fileReplacePosition,
    });
  }

  return { deps };
}
