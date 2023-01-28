import is from '@sindresorhus/is';
import { DockerDatasource } from '../../../../datasource/docker';
import { HelmDatasource } from '../../../../datasource/helm';
import { isOCIRegistry } from '../../../helmv3/utils';
import type { PackageDependency } from '../../../types';
import { DependencyExtractor } from '../../base';
import type { TerraformDefinitionFile } from '../../hcl/types';
import { checkIfStringIsPath } from '../../util';

export class HelmReleaseExtractor extends DependencyExtractor {
  getCheckList(): string[] {
    return [`"helm_release"`];
  }

  override extract(hclMap: TerraformDefinitionFile): PackageDependency[] {
    const dependencies = [];

    const helmReleases = hclMap?.resource?.helm_release;
    if (is.nullOrUndefined(helmReleases)) {
      return [];
    }
    for (const helmRelease of Object.values(helmReleases).flat()) {
      const dep: PackageDependency = {
        currentValue: helmRelease.version,
        depType: 'helm_release',
        depName: helmRelease.chart,
        datasource: HelmDatasource.id,
      };
      if (is.nonEmptyString(helmRelease.repository)) {
        dep.registryUrls = [helmRelease.repository];
      }
      if (!helmRelease.chart) {
        dep.skipReason = 'invalid-name';
      } else if (isOCIRegistry(helmRelease.chart)) {
        // For oci charts, we remove the oci:// and use the docker datasource
        dep.depName = helmRelease.chart.replace('oci://', '');
        dep.datasource = DockerDatasource.id;
      } else if (checkIfStringIsPath(helmRelease.chart)) {
        dep.skipReason = 'local-chart';
      }

      dependencies.push(dep);
    }

    return dependencies;
  }
}
