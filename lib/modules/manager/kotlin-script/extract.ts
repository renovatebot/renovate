import { isString, isTruthy } from '@sindresorhus/is';
import { regEx } from '../../../util/regex.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

const dependsOnBlockRegex = regEx(
  /@file\s*:\s*DependsOn\s*\((?<args>[^)]*)\)/g,
);
const dependencyRegex = regEx(
  /(?<replaceString>"(?<groupId>[^:"]+):(?<artifactId>[^:"]+):(?<version>[^"]+)")/g,
);
const repositoryBlockRegex = regEx(
  /@file\s*:\s*Repository\s*\((?<args>[^)]*)\)/g,
);
const repositoryUrlRegex = regEx(/"(?<repositoryName>[^"]+)"/g);

export function extractPackageFile(
  fileContent: string,
): PackageFileContent | null {
  const registryUrls: string[] = [...fileContent.matchAll(repositoryBlockRegex)]
    .flatMap((block) => [
      ...(block.groups?.args ?? '').matchAll(repositoryUrlRegex),
    ])
    .map((match) => match.groups?.repositoryName)
    .filter(isString);

  const deps: PackageDependency[] = [];
  for (const block of fileContent.matchAll(dependsOnBlockRegex)) {
    const matches = [...(block.groups?.args ?? '').matchAll(dependencyRegex)]
      .map((m) => m.groups)
      .filter(isTruthy);
    for (const match of matches) {
      const dep: PackageDependency = {
        currentValue: match.version,
        depName: `${match.groupId}:${match.artifactId}`,
        replaceString: match.replaceString,
        datasource: MavenDatasource.id,
      };
      deps.push(dep);
    }
  }

  if (deps.length === 0) {
    return null;
  }

  return {
    deps,
    ...(registryUrls.length && { registryUrls }),
  };
}
