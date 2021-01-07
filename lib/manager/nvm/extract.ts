import * as datasourceGithubTags from '../../datasource/github-tags';
import { PackageDependency, PackageFile } from '../common';

export function extractPackageFile(content: string): PackageFile {
  const dep: PackageDependency = {
    depName: 'node',
    currentValue: `v${content.trim().replace(/^v/i, '')}`,
    datasource: datasourceGithubTags.id,
    lookupName: 'nodejs/node',
  };
  return { deps: [dep] };
}
