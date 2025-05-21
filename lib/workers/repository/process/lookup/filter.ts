import semver from 'semver';
import { CONFIG_VALIDATION } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import type { Release } from '../../../../modules/datasource/types';
import type { VersioningApi } from '../../../../modules/versioning';
import * as npmVersioning from '../../../../modules/versioning/npm';
import * as pep440 from '../../../../modules/versioning/pep440';
import * as poetryVersioning from '../../../../modules/versioning/poetry';
import { getRegexPredicate } from '../../../../util/string-match';
import type { FilterConfig } from './types';

function isReleaseStable(
  release: Release,
  versioningApi: VersioningApi,
): boolean {
  if (!versioningApi.isStable(release.version)) {
    return false;
  }

  if (release.isStable === false) {
    return false;
  }

  return true;
}

export function filterVersions(
  config: FilterConfig,
  currentVersion: string,
  latestVersion: string,
  releases: Release[],
  versioningApi: VersioningApi,
): Release[] {
  const { ignoreUnstable, ignoreDeprecated, respectLatest, allowedVersions } =
    config;

  // istanbul ignore if: shouldn't happen
  if (!currentVersion) {
    return [];
  }

  // Leave only versions greater than current
  let filteredReleases = releases.filter(
    (r) =>
      versioningApi.isVersion(r.version) &&
      versioningApi.isGreaterThan(r.version, currentVersion),
  );

  const currentRelease = releases.find(
    (r) =>
      versioningApi.isValid(r.version) &&
      versioningApi.isVersion(r.version) &&
      versioningApi.isValid(currentVersion) &&
      versioningApi.isVersion(currentVersion) &&
      versioningApi.equals(r.version, currentVersion),
  );

  // Don't upgrade from non-deprecated to deprecated
  if (ignoreDeprecated && currentRelease && !currentRelease.isDeprecated) {
    filteredReleases = filteredReleases.filter((r) => {
      if (r.isDeprecated) {
        logger.trace(
          `Skipping ${config.depName!}@${r.version} because it is deprecated`,
        );
        return false;
      }
      return true;
    });
  }

  if (allowedVersions) {
    const isAllowedPred = getRegexPredicate(allowedVersions);
    if (isAllowedPred) {
      filteredReleases = filteredReleases.filter(({ version }) =>
        isAllowedPred(version),
      );
    } else if (versioningApi.isValid(allowedVersions)) {
      filteredReleases = filteredReleases.filter((r) =>
        versioningApi.matches(r.version, allowedVersions),
      );
    } else if (
      config.versioning !== npmVersioning.id &&
      semver.validRange(allowedVersions)
    ) {
      logger.debug(
        { depName: config.depName },
        'Falling back to npm semver syntax for allowedVersions',
      );
      filteredReleases = filteredReleases.filter((r) =>
        semver.satisfies(
          semver.valid(r.version)
            ? r.version
            : /* istanbul ignore next: not reachable, but it's safer to preserve it */ semver.coerce(
                r.version,
              )!,
          allowedVersions,
        ),
      );
    } else if (
      config.versioning === poetryVersioning.id &&
      pep440.isValid(allowedVersions)
    ) {
      logger.debug(
        { depName: config.depName },
        'Falling back to pypi syntax for allowedVersions',
      );
      filteredReleases = filteredReleases.filter((r) =>
        pep440.matches(r.version, allowedVersions),
      );
    } else {
      const error = new Error(CONFIG_VALIDATION);
      error.validationSource = 'config';
      error.validationError = 'Invalid `allowedVersions`';
      error.validationMessage =
        'The following allowedVersions does not parse as a valid version or range: ' +
        JSON.stringify(allowedVersions);
      throw error;
    }
  }

  if (config.followTag) {
    return filteredReleases;
  }

  if (
    respectLatest &&
    latestVersion &&
    !versioningApi.isGreaterThan(currentVersion, latestVersion)
  ) {
    filteredReleases = filteredReleases.filter(
      (r) => !versioningApi.isGreaterThan(r.version, latestVersion),
    );
  }

  if (!ignoreUnstable) {
    return filteredReleases;
  }

  if (currentRelease && isReleaseStable(currentRelease, versioningApi)) {
    return filteredReleases.filter((r) => isReleaseStable(r, versioningApi));
  }

  const currentMajor = versioningApi.getMajor(currentVersion);
  const currentMinor = versioningApi.getMinor(currentVersion);
  const currentPatch = versioningApi.getPatch(currentVersion);

  return filteredReleases.filter((r) => {
    if (isReleaseStable(r, versioningApi)) {
      return true;
    }

    const major = versioningApi.getMajor(r.version);

    if (major !== currentMajor) {
      return false;
    }

    if (versioningApi.allowUnstableMajorUpgrades) {
      return true;
    }

    const minor = versioningApi.getMinor(r.version);
    const patch = versioningApi.getPatch(r.version);

    return minor === currentMinor && patch === currentPatch;
  });
}
