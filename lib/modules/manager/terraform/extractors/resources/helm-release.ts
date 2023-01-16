import is from '@sindresorhus/is';
import { DockerDatasource } from '../../../../datasource/docker';
import { HelmDatasource } from '../../../../datasource/helm';
import type { PackageDependency } from '../../../types';
import { DependencyExtractor } from '../../base';
import { checkIfChartIsOCI, checkIfStringIsPath, ociRegex } from '../../util';

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
          registryUrls: [helmRelease.repository],
          depName: helmRelease.chart,
          datasource: HelmDatasource.id,
        };

        // For oci charts, we remove the oci:// and use the docker datasource
        const isOciChart = checkIfChartIsOCI(helmRelease.chart);
        if (isOciChart) {
          dep.depName = helmRelease.chart.replace(ociRegex, '');
          dep.datasource = DockerDatasource.id;
        }

        if (!helmRelease.chart) {
          dep.skipReason = 'invalid-name';
          // OCI charts strings are valid paths, therefore we exclude them here
        } else if (!isOciChart && checkIfStringIsPath(helmRelease.chart)) {
          dep.skipReason = 'local-chart';
        }
        dependencies.push(dep);
      }
    }

    return dependencies;
  }
}
