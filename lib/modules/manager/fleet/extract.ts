import { isUndefined } from '@sindresorhus/is';
import { regEx } from '../../../util/regex.ts';
import { parseYaml } from '../../../util/yaml.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { HelmDatasource } from '../../datasource/helm/index.ts';
import { getDep } from '../dockerfile/extract.ts';
import { isOCIRegistry, removeOCIPrefix } from '../helmv3/oci.ts';
import { checkIfStringIsPath } from '../terraform/util.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import { FleetFile, type FleetHelmBlock, GitRepo } from './schema.ts';

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

export function extractFleetHelmBlock(
  doc: FleetHelmBlock,
  config: ExtractConfig,
): PackageDependency {
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
      `${removeOCIPrefix(doc.chart)}:${doc.version}`,
      false,
      config.registryAliases,
    );
    delete dockerDep.replaceString;
    return {
      ...dockerDep,
      depType: 'fleet',
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

  const alias = config.registryAliases?.[doc.repo];
  if (alias) {
    dep.registryUrls = [alias];
  } else {
    dep.registryUrls = [doc.repo];
  }

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

function extractFleetFile(
  doc: FleetFile,
  config: ExtractConfig,
): PackageDependency[] {
  const result: PackageDependency[] = [];

  result.push(extractFleetHelmBlock(doc.helm, config));

  if (!isUndefined(doc.targetCustomizations)) {
    // remove version from helm block to allow usage of variables defined in the global block, but do not create PRs
    // if there is no version defined in the customization.
    const helmBlockContext: FleetHelmBlock = { ...doc.helm };
    delete helmBlockContext.version;

    for (const [index, custom] of doc.targetCustomizations.entries()) {
      const dep = extractFleetHelmBlock(
        {
          // merge base config with customization
          ...helmBlockContext,
          ...custom.helm,
        },
        config,
      );
      result.push({
        // overwrite name with customization name to allow splitting of PRs
        ...dep,
        depName: custom.name ?? `targetCustomization[${index}]`, // if no name is provided, use the index
      });
    }
  }
  return result;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig,
): PackageFileContent | null {
  if (!content) {
    return null;
  }
  const deps: PackageDependency[] = [];

  if (regEx('fleet.ya?ml').test(packageFile)) {
    const docs = parseYaml(content, {
      customSchema: FleetFile,
      failureBehaviour: 'filter',
    });
    const fleetDeps = docs.flatMap((doc) => extractFleetFile(doc, config));

    deps.push(...fleetDeps);
  } else {
    const docs = parseYaml(content, {
      customSchema: GitRepo,
      failureBehaviour: 'filter',
    });
    const gitRepoDeps = docs.flatMap(extractGitRepo);
    deps.push(...gitRepoDeps);
  }

  return deps.length ? { deps } : null;
}
