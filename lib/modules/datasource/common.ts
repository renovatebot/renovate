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
  datasourceName: string | undefined,
): string {
  if (!datasourceName) {
    return defaultVersioning.id;
  }

  const datasource = getDatasourceFor(datasourceName);

  if (!datasource) {
    logger.warn({ datasourceName }, 'Missing datasource!');
    return defaultVersioning.id;
  }

  if (!datasource.defaultVersioning) {
    return defaultVersioning.id;
  }

  return datasource.defaultVersioning;
}

export function isGetPkgReleasesConfig(
  input: unknown,
): input is GetPkgReleasesConfig {
  return (
    is.nonEmptyStringAndNotWhitespace(
      (input as GetPkgReleasesConfig).datasource,
    ) &&
    is.nonEmptyStringAndNotWhitespace(
      (input as GetPkgReleasesConfig).packageName,
    )
  );
}

export function applyVersionCompatibility(
  releaseResult: ReleaseResult,
  versionCompatibility: string | undefined,
  currentCompatibility: string | undefined,
): ReleaseResult {
  if (!versionCompatibility) {
    return releaseResult;
  }

  const versionCompatibilityRegEx = regEx(versionCompatibility);
  releaseResult.releases = filterMap(releaseResult.releases, (release) => {
    const regexResult = versionCompatibilityRegEx.exec(release.version);
    if (!regexResult?.groups?.version) {
      logger.trace(
        { releaseVersion: release.version, versionCompatibility },
        'versionCompatibility: Does not match regex',
      );
      return null;
    }
    if (regexResult?.groups?.compatibility !== currentCompatibility) {
      logger.trace(
        { releaseVersion: release.version, versionCompatibility },
        'versionCompatibility: Does not match compatibility',
      );
      return null;
    }
    logger.trace(
      {
        releaseVersion: release.version,
        versionCompatibility,
        version: regexResult.groups.version,
        compatibility: regexResult.groups.compatibility,
      },
      'versionCompatibility: matches',
    );
    release.version = regexResult.groups.version;
    return release;
  });

  return releaseResult;
}

export function applyExtractVersion(
  releaseResult: ReleaseResult,
  extractVersion: string | undefined,
): ReleaseResult {
  if (!extractVersion) {
    return releaseResult;
  }

  const extractVersionRegEx = regEx(extractVersion);
  releaseResult.releases = filterMap(releaseResult.releases, (release) => {
    const version = extractVersionRegEx.exec(release.version)?.groups?.version;
    if (!version) {
      return null;
    }

    release.versionOrig = release.version;
    release.version = version;
    return release;
  });

  return releaseResult;
}

export function filterValidVersions<
  Config extends Pick<GetPkgReleasesConfig, 'versioning' | 'datasource'>,
>(releaseResult: ReleaseResult, config: Config): ReleaseResult {
  const versioningName =
    config.versioning ?? getDefaultVersioning(config.datasource);
  const versioning = allVersioning.get(versioningName);

  releaseResult.releases = filterMap(releaseResult.releases, (release) =>
    versioning.isVersion(release.version) ? release : null,
  );

  return releaseResult;
}

export function sortAndRemoveDuplicates<
  Config extends Pick<GetPkgReleasesConfig, 'versioning' | 'datasource'>,
>(releaseResult: ReleaseResult, config: Config): ReleaseResult {
  const versioningName =
    config.versioning ?? getDefaultVersioning(config.datasource);
  const versioning = allVersioning.get(versioningName);

  releaseResult.releases = releaseResult.releases.sort((a, b) =>
    versioning.sortVersions(a.version, b.version),
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

  return releaseResult;
}

export function applyConstraintsFiltering<
  Config extends Pick<
    GetPkgReleasesConfig,
    | 'constraintsFiltering'
    | 'versioning'
    | 'datasource'
    | 'constraints'
    | 'packageName'
  >,
>(releaseResult: ReleaseResult, config: Config): ReleaseResult {
  if (config?.constraintsFiltering !== 'strict') {
    for (const release of releaseResult.releases) {
      delete release.constraints;
    }

    return releaseResult;
  }

  const versioningName =
    config.versioning ?? getDefaultVersioning(config.datasource);
  const versioning = allVersioning.get(versioningName);

  const configConstraints = config.constraints;
  const filteredReleases: string[] = [];
  const startingLength = releaseResult.releases.length;
  releaseResult.releases = filterMap(releaseResult.releases, (release) => {
    const releaseConstraints = release.constraints;
    delete release.constraints;

    if (!configConstraints || !releaseConstraints) {
      return release;
    }

    for (const [name, configConstraint] of Object.entries(configConstraints)) {
      if (!versioning.isValid(configConstraint)) {
        logger.once.warn(
          {
            packageName: config.packageName,
            constraint: configConstraint,
            versioning: versioningName,
          },
          'Invalid constraint used with strict constraintsFiltering',
        );
        continue;
      }

      const constraint = releaseConstraints[name];
      if (!is.nonEmptyArray(constraint)) {
        // A release with no constraints is OK
        continue;
      }

      let satisfiesConstraints = false;
      for (const releaseConstraint of constraint) {
        if (!releaseConstraint) {
          satisfiesConstraints = true;
          logger.once.debug(
            {
              packageName: config.packageName,
              versioning: versioningName,
              constraint: releaseConstraint,
            },
            'Undefined release constraint',
          );
          break;
        }

        if (!versioning.isValid(releaseConstraint)) {
          logger.once.debug(
            {
              packageName: config.packageName,
              versioning: versioningName,
              constraint: releaseConstraint,
            },
            'Invalid release constraint',
          );
          break;
        }

        if (configConstraint === releaseConstraint) {
          satisfiesConstraints = true;
          break;
        }

        if (versioning.subset?.(configConstraint, releaseConstraint)) {
          satisfiesConstraints = true;
          break;
        }

        if (versioning.matches(configConstraint, releaseConstraint)) {
          satisfiesConstraints = true;
          break;
        }
      }

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
      `Filtered out ${count} non-matching releases out of ${startingLength} total for ${packageName} due to constraintsFiltering=strict: ${releases}`,
    );
  }

  return releaseResult;
}
