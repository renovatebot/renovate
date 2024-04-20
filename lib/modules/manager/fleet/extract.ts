import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import { parseYaml } from '../../../util/yaml';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { HelmDatasource } from '../../datasource/helm';
import { getDep } from '../dockerfile/extract';
import { isOCIRegistry } from '../helmv3/utils';
import { checkIfStringIsPath } from '../terraform/util';
import type { PackageDependency, PackageFileContent } from '../types';
import { FleetFile, type FleetHelmBlock, GitRepo } from './schema';

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

  if (isOCIRegistry(doc.chart)) {
    const dockerDep = getDep(
      `${doc.chart.replace('oci://', '')}:${doc.version}`,
      false,
    );

    return {
      ...dockerDep,
      depType: 'fleet',
      depName: dockerDep.depName,
      packageName: dockerDep.depName,
      // https://github.com/helm/helm/issues/10312
      // https://github.com/helm/helm/issues/10678
      pinDigests: false,
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
      const docs = parseYaml(content, null, {
        json: true,
        customSchema: FleetFile,
        failureBehaviour: 'filter',
      });
      const fleetDeps = docs.flatMap(extractFleetFile);

      deps.push(...fleetDeps);
    } else {
      const docs = parseYaml(content, null, {
        json: true,
        customSchema: GitRepo,
        failureBehaviour: 'filter',
      });
      const gitRepoDeps = docs.flatMap(extractGitRepo);
      deps.push(...gitRepoDeps);
    }
  } catch (err) {
    logger.debug({ error: err, packageFile }, 'Failed to parse fleet YAML');
  }

  return deps.length ? { deps } : null;
}
