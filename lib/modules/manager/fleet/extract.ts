import is from '@sindresorhus/is';
import { loadAll } from 'js-yaml';
import { regEx } from '../../../util/regex';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { HelmDatasource } from '../../datasource/helm';
import { checkIfStringIsPath } from '../terraform/util';
import type { PackageDependency, PackageFile } from '../types';
import type { FleetFile, FleetFileHelm, GitRepo } from './types';

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
      skipReason: 'no-version',
    };
  }

  return {
    ...dep,
    currentValue,
  };
}

function extractFleetFile(doc: FleetFileHelm): PackageDependency {
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
      skipReason: 'no-version',
    };
  }

  return {
    ...dep,
    currentValue,
  };
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
      .filter((doc) => is.truthy(doc?.helm))
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
