import { regEx } from '../../../../util/regex.ts';
import { CpanDatasource } from '../../../datasource/cpan/index.ts';
import type { SourceData } from '../types.ts';

const cpanRegex = regEx(
  /^(?<name>.+?)-(?<version>[\d.]+.*?)\.(?:tar\.gz|tar\.bz2|zip)$/,
);

export function parseCPANUrl(
  parsedUrl: URL,
  expandedUrl: string,
): SourceData | null {
  const filename = parsedUrl.pathname.split('/').pop();
  if (!filename) {
    return null;
  }

  const match = cpanRegex.exec(filename);
  if (!match?.groups) {
    return null;
  }

  const moduleName = match.groups.name.replace(regEx(/-/g), '::');

  return {
    url: expandedUrl,
    version: match.groups.version,
    datasource: CpanDatasource.id,
    packageName: moduleName,
  };
}
