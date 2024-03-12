import is from '@sindresorhus/is';
import { regEx } from '../../../util/regex';
import { MavenDatasource } from '../../datasource/maven';
import type { PackageDependency, PackageFileContent } from '../types';

const dependsOnRegex = regEx(
  /@file\s*:\s*DependsOn\s*\(\s*(?<replaceString>"(?<groupId>.+):(?<artifactId>.+):(?<version>.+)")\s*\)/g,
);
const repositoryRegex = regEx(
  /@file\s*:\s*Repository\s*\(\s*"(?<repositoryName>.+)"\s*\)/g,
);

export function extractPackageFile(
  fileContent: string,
): PackageFileContent | null {
  const registryUrls: string[] = [...fileContent.matchAll(repositoryRegex)]
    .map((match) => match.groups?.repositoryName)
    .filter(is.string);

  const matches = [...fileContent.matchAll(dependsOnRegex)]
    .map((m) => m.groups)
    .filter(is.truthy);
  const deps: PackageDependency[] = [];
  for (const match of matches) {
    const dep: PackageDependency = {
      currentValue: match.version,
      depName: `${match.groupId}:${match.artifactId}`,
      replaceString: match.replaceString,
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
