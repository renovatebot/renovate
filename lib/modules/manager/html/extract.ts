import { regEx } from '../../../util/regex.ts';
import { CdnjsDatasource } from '../../datasource/cdnjs/index.ts';
import { UnpkgDatasource } from '../../datasource/unpkg/index.ts';
import { cloudflareUrlRegex } from '../cdnurl/extract.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

const regex = regEx(/<\s*(?:script|link)\s+[^>]*?\/?>/i);

const integrityRegex = regEx(
  /\s+integrity\s*=\s*(?:"|')(?<currentDigest>[^"']+)/,
);

const unpkgUrlRegex = regEx(
  /\/\/unpkg\.com\/(?<depName>(?:@[^/]+\/)?[^/@]+)@(?<currentValue>[^/]+?)\/(?<asset>[-/_.a-zA-Z0-9]+)/,
);

export function extractDep(tag: string): PackageDependency | null {
  const dep: PackageDependency = {
    replaceString: tag,
  };

  if (cloudflareUrlRegex.test(tag)) {
    const { groups } = cloudflareUrlRegex.exec(tag)!;
    const { depName, currentValue, asset } = groups!;
    dep.datasource = CdnjsDatasource.id;
    dep.depName = depName;
    dep.packageName = `${depName}/${asset}`;
    dep.currentValue = currentValue;
  } else if (unpkgUrlRegex.test(tag)) {
    const { groups } = unpkgUrlRegex.exec(tag)!;
    const { depName, currentValue } = groups!;
    dep.datasource = UnpkgDatasource.id;
    dep.depName = depName;
    dep.packageName = depName;
    dep.currentValue = currentValue;
  } else {
    dep.skipReason = 'unsupported-datasource';
    return dep;
  }

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
