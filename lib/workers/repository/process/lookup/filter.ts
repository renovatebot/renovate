import semver from 'semver';
import { CONFIG_VALIDATION } from '../../../../constants/error-messages';
import type { Release } from '../../../../datasource/types';
import { logger } from '../../../../logger';
import { configRegexPredicate } from '../../../../util/regex';
import type { VersioningApi } from '../../../../versioning';
import * as npmVersioning from '../../../../versioning/npm';
import * as pep440 from '../../../../versioning/pep440';
import * as poetryVersioning from '../../../../versioning/poetry';
import type { FilterConfig } from './types';

export function filterVersions(
  config: FilterConfig,
  currentVersion: string,
  latestVersion: string,
  releases: Release[],
  versioning: VersioningApi
): Release[] {
  const { ignoreUnstable, ignoreDeprecated, respectLatest, allowedVersions } =
    config;
  function isVersionStable(version: string): boolean {
    if (!versioning.isStable(version)) {
      return false;
    }
    // Check if the datasource returned isStable = false
    const release = releases.find((r) => r.version === version);
    if (release?.isStable === false) {
      return false;
    }
    return true;
  }
  // istanbul ignore if: shouldn't happen
  if (!currentVersion) {
    return [];
  }

  // Leave only versions greater than current
  let filteredVersions = releases.filter(
    (v) =>
      versioning.isVersion(v.version) &&
      versioning.isGreaterThan(v.version, currentVersion)
  );

  // Don't upgrade from non-deprecated to deprecated
  const fromRelease = releases.find(
    (release) => release.version === currentVersion
  );
  if (ignoreDeprecated && fromRelease && !fromRelease.isDeprecated) {
    filteredVersions = filteredVersions.filter((v) => {
      const versionRelease = releases.find(
        (release) => release.version === v.version
      );
      if (versionRelease.isDeprecated) {
        logger.trace(
          `Skipping ${config.depName}@${v.version} because it is deprecated`
        );
        return false;
      }
      return true;
    });
  }

  if (allowedVersions) {
    const isAllowedPred = configRegexPredicate(allowedVersions);
    if (isAllowedPred) {
      filteredVersions = filteredVersions.filter(({ version }) =>
        isAllowedPred(version)
      );
    } else if (versioning.isValid(allowedVersions)) {
      filteredVersions = filteredVersions.filter((v) =>
        versioning.matches(v.version, allowedVersions)
      );
    } else if (
      config.versioning !== npmVersioning.id &&
      semver.validRange(allowedVersions)
    ) {
      logger.debug(
        { depName: config.depName },
        'Falling back to npm semver syntax for allowedVersions'
      );
      filteredVersions = filteredVersions.filter((v) =>
        semver.satisfies(semver.coerce(v.version), allowedVersions)
      );
    } else if (
      config.versioning === poetryVersioning.id &&
      pep440.isValid(allowedVersions)
    ) {
      logger.debug(
        { depName: config.depName },
        'Falling back to pypi syntax for allowedVersions'
      );
      filteredVersions = filteredVersions.filter((v) =>
        pep440.matches(v.version, allowedVersions)
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
    return filteredVersions;
  }

  if (
    respectLatest &&
    latestVersion &&
    !versioning.isGreaterThan(currentVersion, latestVersion)
  ) {
    filteredVersions = filteredVersions.filter(
      (v) => !versioning.isGreaterThan(v.version, latestVersion)
    );
  }

  if (!ignoreUnstable) {
    return filteredVersions;
  }

  if (isVersionStable(currentVersion)) {
    return filteredVersions.filter((v) => isVersionStable(v.version));
  }

  // if current is unstable then allow unstable in the current major only
  // Allow unstable only in current major
  return filteredVersions.filter(
    (v) =>
      isVersionStable(v.version) ||
      (versioning.getMajor(v.version) === versioning.getMajor(currentVersion) &&
        versioning.getMinor(v.version) ===
          versioning.getMinor(currentVersion) &&
        versioning.getPatch(v.version) === versioning.getPatch(currentVersion))
  );
}
