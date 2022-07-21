import { regEx } from '../../../util/regex';
import { MavenDatasource } from '../../datasource/maven';
import type { PackageDependency, PackageFile } from '../types';

const dependsOnRegex = regEx(
  /@file\s*:\s*DependsOn\s*\(\s*(?<replaceString>"(?<groupId>.*):(?<artifactId>.*):(?<version>.*)")\s*\)/g
);
const repositoryRegex = regEx(
  /@file\s*:\s*Repository\s*\(\s*"(?<repositoryName>.*)"\s*\)/g
);

export function extractPackageFile(
  fileContent: string,
  packageFile: string
): PackageFile | null {
  if (packageFile.endsWith('.gradle.kts')) {
    return null;
  }

  const registryUrls: string[] = [...fileContent.matchAll(repositoryRegex)]
    .map((match) => {
      return match.groups?.repositoryName;
    })
    .filter((x): x is string => x !== null);

  const deps: PackageDependency[] = [
    ...fileContent.matchAll(dependsOnRegex),
  ].map((match) => {
    const dep: PackageDependency = {
      currentValue: match.groups?.version,
      depName: `${match.groups?.groupId}:${match.groups?.artifactId}`,
      replaceString: match.groups?.replaceString,
      datasource: MavenDatasource.id,
      registryUrls: registryUrls.length > 0 ? registryUrls : null,
    };
    return dep;
  });

  return {
    deps,
  };
}
