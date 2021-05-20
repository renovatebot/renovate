import * as datasourceCdnjs from '../../datasource/cdnjs';
import { cloudflareUrlRegex } from '../cdnurl/extract';
import type { PackageDependency, PackageFile } from '../types';

const regex = /<\s*(script|link)\s+[^>]*?\/?>/i;

const integrityRegex = /\s+integrity\s*=\s*("|')(?<currentDigest>[^"']+)/;

export function extractDep(tag: string): PackageDependency | null {
  const match = cloudflareUrlRegex.exec(tag);
  if (!match) {
    return null;
  }
  const { depName, currentValue, asset } = match.groups;
  const dep: PackageDependency = {
    datasource: datasourceCdnjs.id,
    depName,
    lookupName: `${depName}/${asset}`,
    currentValue,
    replaceString: tag,
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
