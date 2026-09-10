import { isNullOrUndefined, isString } from '@sindresorhus/is';
import { trimTrailingSlash } from '../../../util/url.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { getDep } from '../dockerfile/extract.ts';
import type { PackageDependency } from '../types.ts';
import type { Repository } from './types.ts';

export function isOCIRegistry(
  repository: Repository | string | null | undefined,
): boolean {
  if (isNullOrUndefined(repository)) {
    return false;
  }
  const repo = isString(repository) ? repository : repository.repository;
  return repo.startsWith('oci://');
}

export function removeOCIPrefix(repository: string): string {
  if (isOCIRegistry(repository)) {
    return repository.replace('oci://', '');
  }
  return repository;
}

/**
 * Resolves a Helm chart stored in an OCI registry to the `docker` datasource.
 *
 * @param repository OCI registry or repository URL, with or without the `oci://` prefix
 * @param chart chart name appended to `repository`, omit when `repository` already points to the chart
 * @param registryAliases resolved the same way as for container image references
 * @returns `datasource`, `packageName` and `pinDigests`. Callers set `depName`, `currentValue` and `depType`.
 */
export function getOciChartDep(
  repository: string,
  chart?: string,
  registryAliases?: Record<string, string>,
): PackageDependency {
  const image = trimTrailingSlash(removeOCIPrefix(repository));
  const { packageName, skipReason } = getDep(
    chart ? `${image}/${chart}` : image,
    false,
    registryAliases,
  );
  return {
    datasource: DockerDatasource.id,
    packageName,
    ...(skipReason && { skipReason }),
    // The version fields these managers update cannot carry a digest: Helm only
    // accepts one inside the OCI reference (`chart@sha256:...`, helm/helm#12690)
    // and Flux HelmCharts take semver only. A pin would fail in auto-replace
    // with "Digest is not updated".
    pinDigests: false,
  };
}
