import { isString } from '@sindresorhus/is';
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
  const registryUrls: string[] = [];
  for (const block of fileContent.matchAll(repositoryBlockRegex)) {
    for (const m of (block.groups?.args ?? '').matchAll(repositoryUrlRegex)) {
      const url = m.groups?.repositoryName;
      if (isString(url)) {
        registryUrls.push(url);
      }
    }
  }

  const deps: PackageDependency[] = [];
  for (const block of fileContent.matchAll(dependsOnBlockRegex)) {
    for (const m of (block.groups?.args ?? '').matchAll(dependencyRegex)) {
      if (!m.groups) {
        continue;
      }
      deps.push({
        currentValue: m.groups.version,
        depName: `${m.groups.groupId}:${m.groups.artifactId}`,
        replaceString: m.groups.replaceString,
        datasource: MavenDatasource.id,
      });
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
