import { PackageFile, PackageDependency } from '../common';
import { DATASOURCE_CDNJS } from '../../constants/data-binary-source';
import { cloudflareUrlRegex } from '../cdnurl/extract';

const regex = /<\s*(script|link)\s+[^>]*?\/?>/i;

const integrityRegex = /\s+integrity\s*=\s*("|')(?<currentDigest>[^"']+)/;

export function extractDep(tag: string): PackageDependency | null {
  const match = cloudflareUrlRegex.exec(tag);
  if (!match) {
    return null;
  }
  const { depName, currentValue, asset } = match.groups;
  const dep: PackageDependency = {
    datasource: DATASOURCE_CDNJS,
    depName,
    lookupName: `${depName}/${asset}`,
    currentValue,
    pinDigests: false,
  };
  const integrityMatch = integrityRegex.exec(tag);
  if (integrityMatch) {
    dep.currentDigest = integrityMatch.groups.currentDigest;
  }
  return dep;
}

export function extractPackageFile(content: string): PackageFile {
  const deps: PackageDependency[] = [];

  let rest = content;
  let match = regex.exec(rest);
  let offset = 0;
  let depIndex = 0;
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
        depIndex,
        fileReplacePosition,
        managerData: { tagLength },
        replaceString: tag,
      });
      depIndex += 1;
    }
  }

  return { deps, autoUpdate: true };
}
