import { logger } from '../../../logger';
import { isSkipComment } from '../../../util/ignore';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import type { PackageDependency, PackageFile } from '../types';

const upgradeableTooling: Record<
  string,
  Pick<PackageDependency, 'depName' | 'datasource' | 'packageName'>
> = {
  nodejs: {
    depName: 'node',
    datasource: GithubTagsDatasource.id,
    packageName: 'nodejs/node',
  },
};

export function extractPackageFile(content: string): PackageFile {
  logger.trace('asdf.extractPackageFile()');

  const regex =
    /^(?<content>(?<toolname>(\w+))\s+(?<version>(\d[\d.]+\d)))([^#]*(#(?<comment>(.*))))?/gm;

  const deps: PackageDependency[] = [];

  for (const match of [...content.matchAll(regex)].filter((m) => !!m.groups)) {
    const groups = match.groups!;
    const supportedTool = upgradeableTooling[groups['toolname']];
    if (supportedTool && !isSkipComment((groups['comment'] ?? '').trim())) {
      const dep: PackageDependency = {
        depName: supportedTool.depName,
        currentValue: groups['content'].trim(),
        datasource: supportedTool.datasource,
        packageName: supportedTool.packageName,
      };
      deps.push(dep);
    }
  }

  return { deps };
}
