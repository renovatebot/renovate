import is from '@sindresorhus/is';
import { logger } from '../../../../../logger';
import { joinUrlParts } from '../../../../../util/url';
import { HelmDatasource } from '../../../../datasource/helm';
import { getDep } from '../../../dockerfile/extract';
import { isOCIRegistry, removeOCIPrefix } from '../../../helmv3/oci';
import type { ExtractConfig, PackageDependency } from '../../../types';
import { DependencyExtractor } from '../../base';
import type { TerraformDefinitionFile } from '../../hcl/types';
import type { ProviderLock } from '../../lockfile/types';
import { checkIfStringIsPath } from '../../util';

export class HelmReleaseExtractor extends DependencyExtractor {
  getCheckList(): string[] {
    return [`"helm_release"`];
  }

  override extract(
    hclMap: TerraformDefinitionFile,
    _locks: ProviderLock[],
    config: ExtractConfig,
  ): PackageDependency[] {
    const dependencies = [];

    const helmReleases = hclMap?.resource?.helm_release;
    if (is.nullOrUndefined(helmReleases)) {
      return [];
    }

    // istanbul ignore if
    if (!is.plainObject(helmReleases)) {
      logger.debug(
        { helmReleases },
        'Terraform: unexpected `helmReleases` value',
      );
      return [];
    }

    for (const helmRelease of Object.values(helmReleases).flat()) {
      const dep: PackageDependency = {
        currentValue: helmRelease.version,
        depType: 'helm_release',
        depName: helmRelease.chart,
        datasource: HelmDatasource.id,
      };

      dependencies.push(dep);

      if (!is.nonEmptyString(helmRelease.chart)) {
        dep.skipReason = 'invalid-name';
      } else if (isOCIRegistry(helmRelease.chart)) {
        // For oci charts, we remove the oci:// and use the docker datasource
        dep.depName = removeOCIPrefix(helmRelease.chart);
        this.processOCI(dep.depName, config, dep);
      } else if (checkIfStringIsPath(helmRelease.chart)) {
        dep.skipReason = 'local-chart';
      } else if (is.nonEmptyString(helmRelease.repository)) {
        if (isOCIRegistry(helmRelease.repository)) {
          // For oci charts, we remove the oci:// and use the docker datasource
          this.processOCI(
            joinUrlParts(
              removeOCIPrefix(helmRelease.repository),
              helmRelease.chart,
            ),
            config,
            dep,
          );
        } else {
          dep.registryUrls = [helmRelease.repository];
        }
      }
    }

    return dependencies;
  }

  private processOCI(
    depName: string,
    config: ExtractConfig,
    dep: PackageDependency,
  ): void {
    const { packageName, datasource } = getDep(
      depName,
      false,
      config.registryAliases,
    );
    dep.packageName = packageName;
    dep.datasource = datasource;
  }
}
