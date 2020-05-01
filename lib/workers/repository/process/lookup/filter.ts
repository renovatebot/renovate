import * as semver from 'semver';
import { CONFIG_VALIDATION } from '../../../../constants/error-messages';
import { Release } from '../../../../datasource';
import { logger } from '../../../../logger';
import { regEx } from '../../../../util/regex';
import * as allVersioning from '../../../../versioning';
import * as npmVersioning from '../../../../versioning/npm';
import * as pep440 from '../../../../versioning/pep440';
import * as poetryVersioning from '../../../../versioning/poetry';

export interface FilterConfig {
  allowedVersions?: string;
  depName?: string;
  followTag?: string;
  ignoreDeprecated?: boolean;
  ignoreUnstable?: boolean;
  respectLatest?: boolean;
  versioning: string;
}

const regexes: Record<string, RegExp> = {};

export function filterVersions(
  config: FilterConfig,
  fromVersion: string,
  latestVersion: string,
  versions: string[],
  releases: Release[]
): string[] {
  const {
    versioning,
    ignoreUnstable,
    ignoreDeprecated,
    respectLatest,
    allowedVersions,
  } = config;
  const version = allVersioning.get(versioning);
  if (!fromVersion) {
    return [];
  }

  // Leave only versions greater than current
  let filteredVersions = versions.filter((v) =>
    version.isGreaterThan(v, fromVersion)
  );

  // Don't upgrade from non-deprecated to deprecated
  const fromRelease = releases.find(
    (release) => release.version === fromVersion
  );
  if (ignoreDeprecated && fromRelease && !fromRelease.isDeprecated) {
    filteredVersions = filteredVersions.filter((v) => {
      const versionRelease = releases.find((release) => release.version === v);
      if (versionRelease.isDeprecated) {
        logger.debug(
          `Skipping ${config.depName}@${v} because it is deprecated`
        );
        return false;
      }
      return true;
    });
  }

  if (allowedVersions) {
    if (
      allowedVersions.length > 1 &&
      allowedVersions.startsWith('/') &&
      allowedVersions.endsWith('/')
    ) {
      regexes[allowedVersions] =
        regexes[allowedVersions] || regEx(allowedVersions.slice(1, -1));
      filteredVersions = filteredVersions.filter((v) =>
        regexes[allowedVersions].test(v)
      );
    } else if (
      allowedVersions.length > 2 &&
      allowedVersions.startsWith('!/') &&
      allowedVersions.endsWith('/')
    ) {
      regexes[allowedVersions] =
        regexes[allowedVersions] || regEx(allowedVersions.slice(2, -1));
      filteredVersions = filteredVersions.filter(
        (v) => !regexes[allowedVersions].test(v)
      );
    } else if (version.isValid(allowedVersions)) {
      filteredVersions = filteredVersions.filter((v) =>
        version.matches(v, allowedVersions)
      );
    } else if (
      versioning !== npmVersioning.id &&
      semver.validRange(allowedVersions)
    ) {
      logger.debug(
        { depName: config.depName },
        'Falling back to npm semver syntax for allowedVersions'
      );
      filteredVersions = filteredVersions.filter((v) =>
        semver.satisfies(semver.coerce(v), allowedVersions)
      );
    } else if (
      versioning === poetryVersioning.id &&
      pep440.isValid(allowedVersions)
    ) {
      logger.debug(
        { depName: config.depName },
        'Falling back to pypi syntax for allowedVersions'
      );
      filteredVersions = filteredVersions.filter((v) =>
        pep440.matches(v, allowedVersions)
      );
    } else {
      const error = new Error(CONFIG_VALIDATION);
      error.configFile = 'config';
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
  if (!version.isStable(fromVersion)) {
    // Allow unstable only in current major
    return filteredVersions.filter(
      (v) =>
        version.isStable(v) ||
        (version.getMajor(v) === version.getMajor(fromVersion) &&
          version.getMinor(v) === version.getMinor(fromVersion) &&
          version.getPatch(v) === version.getPatch(fromVersion))
    );
  }

  // Normal case: remove all unstable
  filteredVersions = filteredVersions.filter((v) => version.isStable(v));

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
  // No filtering if fromVersion is already past latest
  if (version.isGreaterThan(fromVersion, latestVersion)) {
    return filteredVersions;
  }
  return filteredVersions.filter(
    (v) => !version.isGreaterThan(v, latestVersion)
  );
}
