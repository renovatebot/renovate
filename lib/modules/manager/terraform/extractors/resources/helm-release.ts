import {
  isNonEmptyString,
  isNullOrUndefined,
  isPlainObject,
} from '@sindresorhus/is';
import { logger } from '../../../../../logger/index.ts';
import { joinUrlParts } from '../../../../../util/url.ts';
import { HelmDatasource } from '../../../../datasource/helm/index.ts';
import { getDep } from '../../../dockerfile/extract.ts';
import { isOCIRegistry, removeOCIPrefix } from '../../../helmv3/oci.ts';
import type { ExtractConfig, PackageDependency } from '../../../types.ts';
import { DependencyExtractor } from '../../base.ts';
import type { TerraformDefinitionFile } from '../../hcl/types.ts';
import type { ProviderLock } from '../../lockfile/types.ts';
import { checkIfStringIsPath } from '../../util.ts';

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
    if (isNullOrUndefined(helmReleases)) {
      return [];
    }

    /* v8 ignore next 7 -- needs test */
    if (!isPlainObject(helmReleases)) {
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

      if (!isNonEmptyString(helmRelease.chart)) {
        dep.skipReason = 'invalid-name';
      } else if (isOCIRegistry(helmRelease.chart)) {
        // For oci charts, we remove the oci:// and use the docker datasource
        dep.depName = removeOCIPrefix(helmRelease.chart);
        this.processOCI(dep.depName, config, dep);
      } else if (checkIfStringIsPath(helmRelease.chart)) {
        dep.skipReason = 'local-chart';
      } else if (isNonEmptyString(helmRelease.repository)) {
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
