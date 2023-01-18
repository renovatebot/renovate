import is from '@sindresorhus/is';
import { HelmDatasource } from '../../../../datasource/helm';
import type { PackageDependency } from '../../../types';
import { DependencyExtractor } from '../../base';
import { checkIfStringIsPath } from '../../util';

export class HelmReleaseExtractor extends DependencyExtractor {
  getCheckList(): string[] {
    return [`"helm_release"`];
  }

  override extract(hclMap: any): PackageDependency[] {
    const dependencies = [];

    const helmReleases = hclMap?.resource?.helm_release;
    if (is.nullOrUndefined(helmReleases)) {
      return [];
    }
    for (const helmReleaseName of Object.keys(helmReleases)) {
      for (const helmRelease of helmReleases[helmReleaseName]) {
        const dep: PackageDependency = {
          currentValue: helmRelease.version,
          depType: 'helm_release',
          depName: helmRelease.chart,
          datasource: HelmDatasource.id,
        };
        if (!is.nullOrUndefined(helmRelease.repository)) {
          dep.registryUrls = [helmRelease.repository];
        }
        if (!helmRelease.chart) {
          dep.skipReason = 'invalid-name';
        } else if (checkIfStringIsPath(helmRelease.chart)) {
          dep.skipReason = 'local-chart';
        }
        dependencies.push(dep);
      }
    }

    return dependencies;
  }
}
