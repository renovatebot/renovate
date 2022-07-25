import is from '@sindresorhus/is';
import { regEx } from '../../../util/regex';
import { MavenDatasource } from '../../datasource/maven';
import type { PackageDependency, PackageFile } from '../types';

const dependsOnRegex = regEx(
  /@file\s*:\s*DependsOn\s*\(\s*(?<replaceString>"(?<groupId>.+):(?<artifactId>.+):(?<version>.+)")\s*\)/g
);
const repositoryRegex = regEx(
  /@file\s*:\s*Repository\s*\(\s*"(?<repositoryName>.*)"\s*\)/g
);

export function extractPackageFile(fileContent: string): PackageFile | null {
  const registryUrls: string[] = [...fileContent.matchAll(repositoryRegex)]
    .map((match) => match.groups?.repositoryName)
    .filter(is.string);

  const matches = [...fileContent.matchAll(dependsOnRegex)];
  const deps: PackageDependency[] = [];
  for (const match of matches) {
    const dep: PackageDependency = {
      currentValue: match.groups?.version,
      depName: `${match.groups?.groupId}:${match.groups?.artifactId}`,
      replaceString: match.groups?.replaceString,
      datasource: MavenDatasource.id,
    };
    deps.push(dep);
  }

  if (deps.length === 0) {
    return null;
  }

  return {
    deps,
    ...(registryUrls.length && { registryUrls }),
  };
}
