import { loadAll } from 'js-yaml';
import { regEx } from '../../../util/regex';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { HelmDatasource } from '../../datasource/helm';
import { checkIfStringIsPath } from '../terraform/util';
import type { PackageDependency, PackageFile } from '../types';
import type { FleetFile, FleetFileHelm, GitRepo } from './types';

function extractGitRepo(doc: GitRepo): PackageDependency {
  const tempDep: PackageDependency = {
    depType: 'git_repo',
    datasource: GitTagsDatasource.id,
  };

  const repo = doc.spec?.repo;
  if (!repo) {
    return {
      ...tempDep,
      skipReason: 'missing-depname',
    };
  }
  tempDep.sourceUrl = repo;
  tempDep.depName = repo;

  const currentValue = doc.spec.revision;
  if (!currentValue) {
    return {
      ...tempDep,
      skipReason: 'no-version',
    };
  }

  return {
    ...tempDep,
    currentValue,
  };
}

function extractFleetFile(doc: FleetFileHelm): PackageDependency {
  const tempDep: PackageDependency = {
    depType: 'fleet',
    datasource: HelmDatasource.id,
  };

  if (!doc.chart) {
    return {
      ...tempDep,
      skipReason: 'missing-depname',
    };
  }
  tempDep.depName = doc.chart;
  tempDep.packageName = doc.chart;

  if (!doc.repo) {
    if (checkIfStringIsPath(doc.chart)) {
      return {
        ...tempDep,
        skipReason: 'local-chart',
      };
    }
    return {
      ...tempDep,
      skipReason: 'no-repository',
    };
  }
  tempDep.registryUrls = [doc.repo];

  const currentValue = doc.version;
  if (!doc.version) {
    return {
      ...tempDep,
      skipReason: 'no-version',
    };
  }
  tempDep.currentValue = currentValue;

  return tempDep;
}

export function extractPackageFile(
  content: string,
  packageFile: string
): PackageFile | null {
  if (!content) {
    return null;
  }
  const deps: PackageDependency[] = [];

  if (regEx('fleet.ya?ml').test(packageFile)) {
    // TODO: fix me (#9610)
    const docs = loadAll(content, null, { json: true }) as FleetFile[];
    const fleetDeps = docs
      .filter((doc) => Boolean(doc?.helm))
      .flatMap((doc) => extractFleetFile(doc.helm));

    deps.push(...fleetDeps);
  } else {
    // TODO: fix me (#9610)
    const docs = loadAll(content, null, { json: true }) as GitRepo[];
    const gitRepoDeps = docs
      .filter((doc) => doc.kind === 'GitRepo') // ensure only GitRepo manifests are processed
      .flatMap((doc) => extractGitRepo(doc));
    deps.push(...gitRepoDeps);
  }

  return deps.length ? { deps } : null;
}
