import is from '@sindresorhus/is';
import { logger } from '../../logger';
import { filterMap } from '../../util/filter-map';
import { regEx } from '../../util/regex';
import { defaultVersioning } from '../versioning';
import * as allVersioning from '../versioning';
import datasources from './api';
import { CustomDatasource } from './custom';
import type {
  DatasourceApi,
  GetPkgReleasesConfig,
  ReleaseResult,
} from './types';

export function getDatasourceFor(datasource: string): DatasourceApi | null {
  if (datasource?.startsWith('custom.')) {
    return getDatasourceFor(CustomDatasource.id);
  }
  return datasources.get(datasource) ?? null;
}

export function getDefaultVersioning(
  datasourceName: string | undefined
): string {
  if (!datasourceName) {
    return defaultVersioning.id;
  }
  const datasource = getDatasourceFor(datasourceName);
  // istanbul ignore if: wrong regex manager config?
  if (!datasource) {
    logger.warn({ datasourceName }, 'Missing datasource!');
  }
  return datasource?.defaultVersioning ?? defaultVersioning.id;
}

export function isGetPkgReleasesConfig(
  input: unknown
): input is GetPkgReleasesConfig {
  return (
    is.nonEmptyStringAndNotWhitespace(
      (input as GetPkgReleasesConfig).datasource
    ) &&
    is.nonEmptyStringAndNotWhitespace(
      (input as GetPkgReleasesConfig).packageName
    )
  );
}

export function applyExtractVersion<
  Config extends Pick<GetPkgReleasesConfig, 'extractVersion'>
>(config: Config, releaseResult: ReleaseResult): void {
  if (!config.extractVersion) {
    return;
  }

  const extractVersionRegEx = regEx(config.extractVersion);
  releaseResult.releases = filterMap(releaseResult.releases, (release) => {
    const version = extractVersionRegEx.exec(release.version)?.groups?.version;
    if (!version) {
      return null;
    }

    release.version = version;
    return release;
  });
}

export function filterValidVersions<
  Config extends Pick<GetPkgReleasesConfig, 'versioning' | 'datasource'>
>(config: Config, releaseResult: ReleaseResult): void {
  const versioningName =
    config.versioning ?? getDefaultVersioning(config.datasource);
  const versioning = allVersioning.get(versioningName);

  releaseResult.releases = filterMap(releaseResult.releases, (release) =>
    versioning.isVersion(release.version) ? release : null
  );
}

export function sortAndRemoveDuplicates<
  Config extends Pick<GetPkgReleasesConfig, 'versioning' | 'datasource'>
>(config: Config, releaseResult: ReleaseResult): void {
  const versioningName =
    config.versioning ?? getDefaultVersioning(config.datasource);
  const versioning = allVersioning.get(versioningName);

  releaseResult.releases = releaseResult.releases.sort((a, b) =>
    versioning.sortVersions(a.version, b.version)
  );

  // Once releases are sorted, deduplication is straightforward and efficient
  let previousVersion: string | null = null;
  releaseResult.releases = filterMap(releaseResult.releases, (release) => {
    if (previousVersion === release.version) {
      return null;
    }
    previousVersion = release.version;
    return release;
  });
}

export function applyConstraintsFiltering<
  Config extends Pick<
    GetPkgReleasesConfig,
    | 'constraintsFiltering'
    | 'versioning'
    | 'datasource'
    | 'constraints'
    | 'packageName'
  >
>(config: Config, releaseResult: ReleaseResult): void {
  if (config?.constraintsFiltering !== 'strict') {
    for (const release of releaseResult.releases) {
      delete release.constraints;
    }
    return;
  }

  const versioningName =
    config.versioning ?? getDefaultVersioning(config.datasource);
  const versioning = allVersioning.get(versioningName);

  const configConstraints = config.constraints;
  const filteredReleases: string[] = [];
  releaseResult.releases = filterMap(releaseResult.releases, (release) => {
    const releaseConstraints = release.constraints;
    delete release.constraints;

    // istanbul ignore if
    if (!configConstraints || !releaseConstraints) {
      return release;
    }

    for (const [name, configConstraint] of Object.entries(configConstraints)) {
      // istanbul ignore if
      if (!versioning.isValid(configConstraint)) {
        continue;
      }

      const constraint = releaseConstraints[name];
      if (!is.nonEmptyArray(constraint)) {
        // A release with no constraints is OK
        continue;
      }

      const satisfiesConstraints = constraint.some(
        // If the constraint value is a subset of any release's constraints, then it's OK
        // fallback to release's constraint match if subset is not supported by versioning
        (releaseConstraint) =>
          !releaseConstraint ||
          (versioning.subset?.(configConstraint, releaseConstraint) ??
            versioning.matches(configConstraint, releaseConstraint))
      );

      if (!satisfiesConstraints) {
        filteredReleases.push(release.version);
        return null;
      }
    }

    return release;
  });

  if (filteredReleases.length) {
    const count = filteredReleases.length;
    const packageName = config.packageName;
    const releases = filteredReleases.join(', ');
    logger.debug(
      `Filtered ${count} releases for ${packageName} due to constraintsFiltering=strict: ${releases}`
    );
  }
}
