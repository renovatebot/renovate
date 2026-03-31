import { regEx } from '../../../util/regex.ts';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags/index.ts';
import { getDep } from '../dockerfile/extract.ts';
import type { PackageDependency } from '../types.ts';
import type { BitbucketPipelinesDepType } from './dep-types.ts';

export const pipeRegex = regEx(`^\\s*-\\s?pipe:\\s*'?"?([^\\s'"]+)'?"?\\s*$`);
export const dockerImageRegex = regEx(
  `^\\s*-?\\s?image:\\s*'?"?([^\\s'"]+)'?"?\\s*$`,
);
export const dockerImageObjectRegex = regEx('^(?<spaces>\\s*)image:\\s*$');

export function addDepAsBitbucketTag(
  deps: PackageDependency[],
  pipe: string,
): void {
  const [depName, currentValue] = pipe.split(':');
  const dep: PackageDependency<
    Record<string, any>,
    BitbucketPipelinesDepType
  > = {
    depName,
    currentValue,
    datasource: BitbucketTagsDatasource.id,
    depType: 'bitbucket-tags',
  };
  deps.push(dep);
}

export function addDepAsDockerImage(
  deps: PackageDependency[],
  currentDockerImage: string,
  registryAliases?: Record<string, string>,
): void {
  const dep: PackageDependency<
    Record<string, any>,
    BitbucketPipelinesDepType
  > = {
    ...getDep(currentDockerImage, true, registryAliases),
    depType: 'docker',
  };
  deps.push(dep);
}

export function addDepFromObject(
  deps: PackageDependency[],
  lines: string[],
  start: number,
  len: number,
  spaces: string,
  registryAliases?: Record<string, string>,
): number {
  const nameRegex = regEx(
    `^${spaces}\\s+name:\\s*['"]?(?<image>[^\\s'"]+)['"]?\\s*$`,
  );
  const indentRegex = regEx(`^${spaces}\\s+`);

  for (let idx = start + 1; idx < len; idx++) {
    const line = lines[idx];

    if (!indentRegex.test(line)) {
      // malformed
      return idx;
    }

    const groups = nameRegex.exec(line)?.groups;
    if (groups) {
      const dep: PackageDependency<
        Record<string, any>,
        BitbucketPipelinesDepType
      > = {
        ...getDep(groups.image, true, registryAliases),
        depType: 'docker',
      };
      deps.push(dep);
      return idx;
    }
  }

  // malformed
  return start;
}
