import { PackageFile, PackageDependency } from '../common';

export function extractPackageFile(content: string): PackageFile {
  const deps: PackageDependency[] = [];

  const regex = /\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/(?<depName>[^/]+?)\/(?<currentValue>[^/]+?)\/(?<asset>[-_.a-zA-Z0-9]+)/;
  let rest = content;
  let match = regex.exec(rest);
  let offset = 0;
  while (match) {
    const [wholeSubstr] = match;
    const { depName, currentValue, asset } = match.groups;

    const fileReplacePosition =
      offset + match.index + wholeSubstr.indexOf(currentValue);

    offset += match.index + wholeSubstr.length;
    rest = content.slice(offset);
    match = regex.exec(rest);

    deps.push({
      datasource: 'cdnjs',
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
