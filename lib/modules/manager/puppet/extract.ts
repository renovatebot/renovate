import { logger } from '../../../logger';
import * as gitVersioning from '../../versioning/git';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { PuppetDatasource } from '../../datasource/puppet';
import type { PackageDependency, PackageFile } from '../types';
import {
  gitModuleRegexFactory,
  simpleModuleLineRegexFactory,
} from './constants';

export function extractPackageFile(
  content: string,
  fileName: string
): PackageFile | null {
  logger.debug('extract puppet dependencies');

  const deps: PackageDependency[] = [];
  const simpleModuleLineRegex = simpleModuleLineRegexFactory();
  const gitModuleRegex = gitModuleRegexFactory();

  let line: RegExpExecArray;
  while ((line = simpleModuleLineRegex.exec(content)) !== null) {
    const module = line[1];
    const version = line[2];

    const dep: PackageDependency = {
      depName: module,
      datasource: PuppetDatasource.id,
      packageName: module,
      currentValue: version,
      registryUrls: ['https://forgeapi.puppet.com'],
    };

    deps.push(dep);
  }

  while ((line = gitModuleRegex.exec(content)) !== null) {
    const map = new Map();

    const packageName = line.groups.packageName;

    [1, 2, 3].forEach((i) => {
      const key = line.groups[`key${i}`];
      const value = line.groups[`value${i}`];

      if (key && value) {
        map.set(key, value);
      }
    });

    const git = map.get('git');
    const commit = map.get('commit');

    // TODO: find out how to create proper git/github/gitlab PackageDependency

    const dep: PackageDependency = {
      depName: packageName,
      packageName: git,
      datasource: GitRefsDatasource.id,
      currentDigest: commit,
      versioning: commit ? gitVersioning.id : undefined,
    };

    deps.push(dep);
  }

  return {
    deps,
  };
}
