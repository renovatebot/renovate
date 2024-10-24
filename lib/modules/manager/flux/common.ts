import { regEx } from '../../../util/regex';
import { HelmDatasource } from '../../datasource/helm';
import type { PackageDependency } from '../types';
import type { HelmChart, HelmRelease, HelmRepository } from './schema';
import type { FluxManifest } from './types';

export const systemManifestFileNameRegex = '(?:^|/)gotk-components\\.ya?ml$';

export const systemManifestHeaderRegex =
  '#\\s*Flux\\s+Version:\\s*(\\S+)(?:\\s*#\\s*Components:\\s*([A-Za-z,-]+))?';

export function isSystemManifest(file: string): boolean {
  return regEx(systemManifestFileNameRegex).test(file);
}

export function resolveHelmReleaseManifest(
  resource: HelmRelease,
  helmRepositories: HelmRepository[],
  helmCharts: HelmChart[],
): {
  name: string;
  dep: PackageDependency;
  matchingRepositories: HelmRepository[];
} | null {
  if (resource.spec.chartRef) {
    const chartRef = resource.spec.chartRef;
    const helmChart = helmCharts.find(
      (res) =>
        res.kind === chartRef.kind &&
        res.metadata.name === chartRef.name &&
        res.metadata.namespace ===
          (chartRef.namespace ?? resource.metadata?.namespace),
    );
    if (!helmChart) {
      return null;
    }
    const chartName = helmChart.spec.chart;

    const dep: PackageDependency = {
      depName: chartName,
      currentValue: helmChart.spec.version,
      datasource: HelmDatasource.id,
    };

    const matchingRepositories = helmRepositories.filter(
      (rep) =>
        rep.kind === helmChart.spec.sourceRef?.kind &&
        rep.metadata.name === helmChart.spec.sourceRef.name &&
        rep.metadata.namespace === helmChart.metadata?.namespace,
    );
    return { name: chartName, dep, matchingRepositories };
  } else if (resource.spec.chart) {
    const chartSpec = resource.spec.chart.spec;
    const chartName = chartSpec.chart;

    const dep: PackageDependency = {
      depName: chartName,
      currentValue: resource.spec.chart.spec.version,
      datasource: HelmDatasource.id,
    };

    const matchingRepositories = helmRepositories.filter(
      (rep) =>
        rep.kind === chartSpec.sourceRef?.kind &&
        rep.metadata.name === chartSpec.sourceRef.name &&
        rep.metadata.namespace ===
          (chartSpec.sourceRef.namespace ?? resource.metadata?.namespace),
    );

    return { name: chartName, dep, matchingRepositories };
  } else {
    return null;
  }
}

export function collectHelmReposAndCharts(
  manifests: FluxManifest[],
): [HelmRepository[], HelmChart[]] {
  const helmRepositories: HelmRepository[] = [];
  const helmCharts: HelmChart[] = [];

  for (const manifest of manifests) {
    if (manifest.kind === 'resource') {
      for (const resource of manifest.resources) {
        switch (resource.kind) {
          case 'HelmRepository':
            helmRepositories.push(resource);
            break;
          case 'HelmChart':
            helmCharts.push(resource);
            break;
        }
      }
    }
  }

  return [helmRepositories, helmCharts];
}
