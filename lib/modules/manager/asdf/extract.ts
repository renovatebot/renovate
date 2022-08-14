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
  const regex = /^(?<content>(?<toolname>(\w+))\s+(?<version>(\d[\d.]+\d)))/gm;

  const deps = [...content.matchAll(regex)]
    .filter((match) => !!match.groups)
    .map((match) => match.groups!)
    .filter((groups) => upgradeableTooling[groups['toolname']])
    .map((groups) => {
      const tool = upgradeableTooling[groups['toolname']];
      const dep: PackageDependency = {
        depName: tool.depName,
        currentValue: groups['content'].trim(),
        datasource: tool.datasource,
        packageName: tool.packageName,
      };
      return dep;
    });

  return { deps };
}
