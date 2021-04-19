import * as semver from 'semver';
import { CONFIG_VALIDATION } from '../../../../constants/error-messages';
import type { Release } from '../../../../datasource/types';
import { logger } from '../../../../logger';
import { configRegexPredicate, isConfigRegex } from '../../../../util/regex';
import * as allVersioning from '../../../../versioning';
import * as npmVersioning from '../../../../versioning/npm';
import * as pep440 from '../../../../versioning/pep440';
import * as poetryVersioning from '../../../../versioning/poetry';
import type { FilterConfig } from './types';

export function filterVersions(
  config: FilterConfig,
  currentVersion: string,
  latestVersion: string,
  releases: Release[]
): Release[] {
  const {
    ignoreUnstable,
    ignoreDeprecated,
    respectLatest,
    allowedVersions,
  } = config;
  let versioning;
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
  versioning = allVersioning.get(config.versioning);
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
        logger.debug(
          `Skipping ${config.depName}@${v.version} because it is deprecated`
        );
        return false;
      }
      return true;
    });
  }

  if (allowedVersions) {
    if (isConfigRegex(allowedVersions)) {
      const isAllowed = configRegexPredicate(allowedVersions);
      filteredVersions = filteredVersions.filter(({ version }) =>
        isAllowed(version)
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
      error.location = 'config';
      error.validationError = 'Invalid `allowedVersions`';
      error.validationMessage =
        'The following allowedVersions does not parse as a valid version or range: ' +
        JSON.stringify(allowedVersions);
      throw error;
    }
  }

  // Return all versions if we aren't ignore unstable. Also ignore latest
  if (config.followTag || ignoreUnstable === false) {
    return filteredVersions;
  }

  // if current is unstable then allow unstable in the current major only
  if (!isVersionStable(currentVersion)) {
    // Allow unstable only in current major
    return filteredVersions.filter(
      (v) =>
        isVersionStable(v.version) ||
        (versioning.getMajor(v.version) ===
          versioning.getMajor(currentVersion) &&
          versioning.getMinor(v.version) ===
            versioning.getMinor(currentVersion) &&
          versioning.getPatch(v.version) ===
            versioning.getPatch(currentVersion))
    );
  }

  // Normal case: remove all unstable
  filteredVersions = filteredVersions.filter((v) => isVersionStable(v.version));

  // Filter the latest

  // No filtering if no latest
  // istanbul ignore if
  if (!latestVersion) {
    return filteredVersions;
  }
  // No filtering if not respecting latest
  if (respectLatest === false) {
    return filteredVersions;
  }
  // No filtering if currentVersion is already past latest
  if (versioning.isGreaterThan(currentVersion, latestVersion)) {
    return filteredVersions;
  }
  return filteredVersions.filter(
    (v) => !versioning.isGreaterThan(v.version, latestVersion)
  );
}
