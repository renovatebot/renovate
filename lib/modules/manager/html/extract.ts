import { regEx } from '../../../util/regex';
import { CdnJsDatasource } from '../../datasource/cdnjs';
import { cloudflareUrlRegex } from '../cdnurl/extract';
import type { PackageDependency, PackageFileContent } from '../types';

const regex = regEx(/<\s*(script|link)\s+[^>]*?\/?>/i);

const integrityRegex = regEx(
  /\s+integrity\s*=\s*("|')(?<currentDigest>[^"']+)/,
);

export function extractDep(tag: string): PackageDependency | null {
  const match = cloudflareUrlRegex.exec(tag);
  if (!match?.groups) {
    return null;
  }
  const { depName, currentValue, asset } = match.groups;
  const dep: PackageDependency = {
    datasource: CdnJsDatasource.id,
    depName,
    packageName: `${depName}/${asset}`,
    currentValue,
    replaceString: tag,
  };
  const integrityMatch = integrityRegex.exec(tag);
  if (integrityMatch?.groups) {
    dep.currentDigest = integrityMatch.groups.currentDigest;
  }
  return dep;
}

export function extractPackageFile(content: string): PackageFileContent | null {
  const deps: PackageDependency[] = [];
  let rest = content;
  let match = regex.exec(rest);
  let offset = 0;
  while (match) {
    const [replaceString] = match;
    offset += match.index + replaceString.length;
    rest = content.slice(offset);
    match = regex.exec(rest);
    const dep = extractDep(replaceString);
    if (dep) {
      deps.push(dep);
    }
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
