import { PackageFile, PackageDependency } from '../common';
import { DATASOURCE_CDNJS } from '../../constants/data-binary-source';
import { cloudflareUrlRegex } from '../cdnurl/extract';

const regex = /<\s*(script|link)\s+[^>]*?\/?>/i;

export function extractDep(tag: string): PackageDependency | null {
  const match = cloudflareUrlRegex.exec(tag);
  if (match) {
    const { depName, currentValue, asset } = match.groups;
    return {
      datasource: DATASOURCE_CDNJS,
      depName,
      lookupName: `${depName}/${asset}`,
      currentValue,
    };
  }
  return null;
}

export function extractPackageFile(content: string): PackageFile {
  const deps: PackageDependency[] = [];

  let rest = content;
  let match = regex.exec(rest);
  let offset = 0;
  while (match) {
    const [tag] = match;
    const tagLength = tag.length;
    const fileReplacePosition = offset + match.index;

    offset += match.index + tag.length;
    rest = content.slice(offset);
    match = regex.exec(rest);

    const dep = extractDep(tag);
    if (dep) {
      deps.push({
        ...dep,
        fileReplacePosition,
        managerData: { tagLength },
      });
    }
  }

  return { deps };
}
