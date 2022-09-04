import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { isSkipComment } from '../../../util/ignore';
import { regEx } from '../../../util/regex';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import * as nodeVersioning from '../../versioning/node';
import type { PackageDependency, PackageFile } from '../types';

const upgradeableTooling: Record<
  string,
  Pick<
    PackageDependency,
    'depName' | 'datasource' | 'packageName' | 'versioning'
  >
> = {
  nodejs: {
    depName: 'node',
    datasource: GithubTagsDatasource.id,
    packageName: 'nodejs/node',
    versioning: nodeVersioning.id,
  },
};

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace('asdf.extractPackageFile()');

  const regex = regEx(
    /^(?<toolName>(\w+))\s+((?<version>(\d[\d.]+\d))|(?<altVersion>([^\s]+)))([^#]*(#(?<comment>(.*))))?/gm
  );

  const deps: PackageDependency[] = [];

  for (const groups of [...content.matchAll(regex)]
    .map((m) => m.groups)
    .filter(is.truthy)) {
    const supportedTool = upgradeableTooling[groups.toolName];
    if (supportedTool) {
      if (groups.version) {
        const dep: PackageDependency = {
          currentValue: groups.version.trim(),
          ...supportedTool,
        };
        if (isSkipComment((groups.comment ?? '').trim())) {
          dep.skipReason = 'ignored';
        }

        deps.push(dep);
      } else {
        const dep: PackageDependency = {
          currentValue: groups.altVersion.trim(),
          depName: supportedTool.depName,
          skipReason: 'unsupported-version',
        };

        deps.push(dep);
      }
    } else {
      const dep: PackageDependency = {
        depName: groups.toolName.trim(),
        skipReason: 'unsupported-datasource',
      };

      deps.push(dep);
    }
  }

  return deps.length ? { deps } : null;
}
