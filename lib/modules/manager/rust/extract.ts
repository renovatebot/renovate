import { regEx } from '../../../util/regex';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { regexMatchAll } from '../custom/regex/utils';
import type { PackageDependency, PackageFileContent } from '../types';

const channelRegex = regEx(
  /channel\s*=\s*"(?<currentValue>\d+\.\d+(\.\d+)?)"/,
  'g',
);

export function extractPackageFile(content: string): PackageFileContent {
  const deps: PackageDependency[] = [];
  for (const match of regexMatchAll(channelRegex, content)) {
    const groups = match.groups;
    if (groups) {
      const { currentValue } = groups;
      deps.push({
        depName: 'rust',
        packageName: 'rust-lang/rust',
        currentValue,
        datasource: GithubReleasesDatasource.id,
      });
    }
  }
  return { deps };
}
