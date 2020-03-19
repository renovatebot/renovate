import { PackageFile, PackageDependency } from '../common';
import * as datasourceGithubTags from '../../datasource/github-tags';

export function extractPackageFile(content: string): PackageFile {
  const dep: PackageDependency = {
    depName: 'node',
    currentValue: content.trim(),
    datasource: datasourceGithubTags.id,
    lookupName: 'nodejs/node',
  };
  return { deps: [dep] };
}
