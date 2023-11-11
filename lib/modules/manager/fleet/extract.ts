import is from '@sindresorhus/is';
import { loadAll } from 'js-yaml';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { HelmDatasource } from '../../datasource/helm';
import { checkIfStringIsPath } from '../terraform/util';
import type { PackageDependency, PackageFileContent } from '../types';
import type { FleetFile, FleetHelmBlock, GitRepo } from './types';

function extractGitRepo(doc: GitRepo): PackageDependency {
  const dep: PackageDependency = {
    depType: 'git_repo',
    datasource: GitTagsDatasource.id,
  };

  const repo = doc.spec?.repo;
  if (!repo) {
    return {
      ...dep,
      skipReason: 'missing-depname',
    };
  }
  dep.sourceUrl = repo;
  dep.depName = repo;

  const currentValue = doc.spec.revision;
  if (!currentValue) {
    return {
      ...dep,
      skipReason: 'unspecified-version',
    };
  }

  return {
    ...dep,
    currentValue,
  };
}

function extractFleetHelmBlock(doc: FleetHelmBlock): PackageDependency {
  const dep: PackageDependency = {
    depType: 'fleet',
    datasource: HelmDatasource.id,
  };

  if (!doc.chart) {
    return {
      ...dep,
      skipReason: 'missing-depname',
    };
  }
  dep.depName = doc.chart;
  dep.packageName = doc.chart;

  if (!doc.repo) {
    if (checkIfStringIsPath(doc.chart)) {
      return {
        ...dep,
        skipReason: 'local-chart',
      };
    }
    return {
      ...dep,
      skipReason: 'no-repository',
    };
  }
  dep.registryUrls = [doc.repo];

  const currentValue = doc.version;
  if (!doc.version) {
    return {
      ...dep,
      skipReason: 'unspecified-version',
    };
  }

  return {
    ...dep,
    currentValue,
  };
}

function extractFleetFile(doc: FleetFile): PackageDependency[] {
  const result: PackageDependency[] = [];

  result.push(extractFleetHelmBlock(doc.helm));

  if (!is.undefined(doc.targetCustomizations)) {
    // remove version from helm block to allow usage of variables defined in the global block, but do not create PRs
    // if there is no version defined in the customization.
    const helmBlockContext: FleetHelmBlock = { ...doc.helm };
    delete helmBlockContext.version;

    for (const custom of doc.targetCustomizations) {
      const dep = extractFleetHelmBlock({
        // merge base config with customization
        ...helmBlockContext,
        ...custom.helm,
      });
      result.push({
        // overwrite name with customization name to allow splitting of PRs
        ...dep,
        depName: custom.name,
      });
    }
  }
  return result;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  if (!content) {
    return null;
  }
  const deps: PackageDependency[] = [];

  try {
    if (regEx('fleet.ya?ml').test(packageFile)) {
      // TODO: fix me (#9610)
      const docs = loadAll(content, null, { json: true }) as FleetFile[];
      const fleetDeps = docs
        .filter((doc) => is.truthy(doc?.helm))
        .flatMap((doc) => extractFleetFile(doc));

      deps.push(...fleetDeps);
    } else {
      // TODO: fix me (#9610)
      const docs = loadAll(content, null, { json: true }) as GitRepo[];
      const gitRepoDeps = docs
        .filter((doc) => doc.kind === 'GitRepo') // ensure only GitRepo manifests are processed
        .flatMap((doc) => extractGitRepo(doc));
      deps.push(...gitRepoDeps);
    }
  } catch (err) {
    logger.debug({ error: err, packageFile }, 'Failed to parse fleet YAML');
  }

  return deps.length ? { deps } : null;
}
