import {
  RenovateConfig,
  UpdateType,
  ValidationMessage,
} from '../../../../config';
import {
  Release,
  getDefaultVersioning,
  getDigest,
  getPkgReleases,
  isGetPkgReleasesConfig,
  supportsDigests,
} from '../../../../datasource';
import * as datasourceGitSubmodules from '../../../../datasource/git-submodules';
import { logger } from '../../../../logger';
import { getRangeStrategy } from '../../../../manager';
import { LookupUpdate, RangeConfig } from '../../../../manager/common';
import { SkipReason } from '../../../../types';
import { clone } from '../../../../util/clone';
import { applyPackageRules } from '../../../../util/package-rules';
import * as allVersioning from '../../../../versioning';
import { FilterConfig, filterVersions } from './filter';
import { RollbackConfig, getRollbackUpdate } from './rollback';

export interface UpdateResult {
  sourceDirectory?: string;
  changelogUrl?: string;
  dependencyUrl?: string;
  homepage?: string;
  deprecationMessage?: string;
  sourceUrl?: string;
  skipReason: SkipReason;
  releases: Release[];
  fixedVersion?: string;
  updates: LookupUpdate[];
  warnings: ValidationMessage[];
}

export interface LookupUpdateConfig
  extends RollbackConfig,
    FilterConfig,
    RangeConfig,
    RenovateConfig {
  separateMinorPatch?: boolean;
  digestOneAndOnly?: boolean;
  pinDigests?: boolean;
  rollbackPrs?: boolean;
  currentDigest?: string;
  lockedVersion?: string;
  vulnerabilityAlert?: boolean;
  separateMajorMinor?: boolean;
  separateMultipleMajor?: boolean;
  datasource: string;
  depName: string;
}

function getType(
  config: LookupUpdateConfig,
  currentVersion: string,
  newVersion: string
): UpdateType {
  const { versioning } = config;
  const version = allVersioning.get(versioning);
  if (version.getMajor(newVersion) > version.getMajor(currentVersion)) {
    return 'major';
  }
  if (version.getMinor(newVersion) > version.getMinor(currentVersion)) {
    return 'minor';
  }
  if (config.separateMinorPatch) {
    return 'patch';
  }
  if (config.patch.automerge && !config.minor.automerge) {
    return 'patch';
  }
  return 'minor';
}

function getFromVersion(
  config: LookupUpdateConfig,
  rangeStrategy: string,
  latestVersion: string,
  allVersions: string[]
): string | null {
  const { currentValue, lockedVersion, versioning } = config;
  const version = allVersioning.get(versioning);
  if (version.isVersion(currentValue)) {
    return currentValue;
  }
  if (version.isSingleVersion(currentValue)) {
    return currentValue.replace(/=/g, '').trim();
  }
  logger.trace(`currentValue ${currentValue} is range`);
  let useVersions = allVersions.filter((v) => version.matches(v, currentValue));
  if (latestVersion && version.matches(latestVersion, currentValue)) {
    useVersions = useVersions.filter(
      (v) => !version.isGreaterThan(v, latestVersion)
    );
  }
  if (rangeStrategy === 'pin') {
    return (
      lockedVersion || version.getSatisfyingVersion(useVersions, currentValue)
    );
  }
  if (rangeStrategy === 'bump') {
    // Use the lowest version in the current range
    return version.minSatisfyingVersion(useVersions, currentValue);
  }
  // Use the highest version in the current range
  return version.getSatisfyingVersion(useVersions, currentValue);
}

function getBucket(
  config: LookupUpdateConfig,
  currentVersion: string,
  newVersion: string,
  versioning: allVersioning.VersioningApi
): string {
  const {
    separateMajorMinor,
    separateMultipleMajor,
    separateMinorPatch,
  } = config;
  if (!separateMajorMinor) {
    return 'latest';
  }
  const fromMajor = versioning.getMajor(currentVersion);
  const toMajor = versioning.getMajor(newVersion);
  if (fromMajor !== toMajor) {
    if (separateMultipleMajor) {
      return `major-${toMajor}`;
    }
    return 'major';
  }
  if (separateMinorPatch) {
    if (
      versioning.getMinor(currentVersion) === versioning.getMinor(newVersion)
    ) {
      return 'patch';
    }
    return 'minor';
  }
  return 'non-major';
}

export async function lookupUpdates(
  inconfig: LookupUpdateConfig
): Promise<UpdateResult> {
  let config: LookupUpdateConfig = { ...inconfig };
  const { depName, currentValue, lockedVersion, vulnerabilityAlert } = config;
  logger.trace({ dependency: depName, currentValue }, 'lookupUpdates');
  // Use the datasource's default versioning if none is configured
  const versioning = allVersioning.get(
    config.versioning || getDefaultVersioning(config.datasource)
  );
  const res: UpdateResult = { updates: [], warnings: [] } as any;

  const isValid = currentValue && versioning.isValid(currentValue);
  if (!isValid) {
    res.skipReason = SkipReason.InvalidValue;
  }
  // Record if the dep is fixed to a version
  if (lockedVersion) {
    res.fixedVersion = lockedVersion;
  } else if (currentValue && versioning.isSingleVersion(currentValue)) {
    res.fixedVersion = currentValue.replace(/^=+/, '');
  }
  // istanbul ignore if
  if (!isGetPkgReleasesConfig(config)) {
    res.skipReason = SkipReason.Unknown;
    return res;
  }

  if (isValid) {
    const dependency = clone(await getPkgReleases(config));
    if (!dependency) {
      // If dependency lookup fails then warn and return
      const warning: ValidationMessage = {
        depName,
        message: `Failed to look up dependency ${depName}`,
      };
      logger.debug(
        { dependency: depName, packageFile: config.packageFile },
        warning.message
      );
      // TODO: return warnings in own field
      res.warnings.push(warning);
      return res;
    }
    if (dependency.deprecationMessage) {
      logger.debug({ dependency: depName }, 'Found deprecationMessage');
      res.deprecationMessage = dependency.deprecationMessage;
    }
    res.sourceUrl = dependency?.sourceUrl;
    if (dependency.sourceDirectory) {
      res.sourceDirectory = dependency.sourceDirectory;
    }
    res.homepage = dependency.homepage;
    res.changelogUrl = dependency.changelogUrl;
    res.dependencyUrl = dependency?.dependencyUrl;
    const { releases } = dependency;
    const latestVersion = dependency.tags?.latest;
    // Filter out any results from datasource that don't comply with our versioning
    let allVersions = releases.filter((release) =>
      versioning.isVersion(release.version)
    );
    // istanbul ignore if
    if (allVersions.length === 0) {
      const message = `Found no results from datasource that look like a version`;
      logger.debug({ dependency: depName, result: dependency }, message);
      if (!config.currentDigest) {
        return res;
      }
    }
    // Reapply package rules in case we missed something from sourceUrl
    config = applyPackageRules({ ...config, sourceUrl: res.sourceUrl });
    if (config.followTag) {
      const taggedVersion = dependency.tags[config.followTag];
      if (!taggedVersion) {
        res.warnings.push({
          depName,
          message: `Can't find version with tag ${config.followTag} for ${depName}`,
        });
        return res;
      }
      allVersions = allVersions.filter(
        (v) =>
          v.version === taggedVersion ||
          (v.version === currentValue &&
            versioning.isGreaterThan(taggedVersion, currentValue))
      );
    }
    // Check that existing constraint can be satisfied
    const allSatisfyingVersions = allVersions.filter((v) =>
      versioning.matches(v.version, currentValue)
    );
    if (config.rollbackPrs && !allSatisfyingVersions.length) {
      const rollback = getRollbackUpdate(config, allVersions);
      // istanbul ignore if
      if (!rollback) {
        res.warnings.push({
          depName,
          message: `Can't find version matching ${currentValue} for ${depName}`,
        });
        return res;
      }
      res.updates.push(rollback);
    }
    let rangeStrategy = getRangeStrategy(config);
    // istanbul ignore next
    if (
      vulnerabilityAlert &&
      rangeStrategy === 'update-lockfile' &&
      !lockedVersion
    ) {
      rangeStrategy = 'bump';
    }
    const nonDeprecatedVersions = releases
      .filter((release) => !release.isDeprecated)
      .map((release) => release.version);
    const currentVersion =
      getFromVersion(
        config,
        rangeStrategy,
        latestVersion,
        nonDeprecatedVersions
      ) ||
      getFromVersion(
        config,
        rangeStrategy,
        latestVersion,
        allVersions.map((v) => v.version)
      );
    if (
      currentVersion &&
      rangeStrategy === 'pin' &&
      !versioning.isSingleVersion(currentValue)
    ) {
      res.updates.push({
        updateType: 'pin',
        isPin: true,
        newValue: versioning.getNewValue({
          currentValue,
          rangeStrategy,
          currentVersion,
          newVersion: currentVersion,
        }),
        newMajor: versioning.getMajor(currentVersion),
      });
    }
    let filterStart = currentVersion;
    if (lockedVersion && rangeStrategy === 'update-lockfile') {
      // Look for versions greater than the current locked version that still satisfy the package.json range
      filterStart = lockedVersion;
    }
    // Filter latest, unstable, etc
    let filteredVersions = filterVersions(
      config,
      filterStart,
      latestVersion,
      allVersions
    ).filter((v) =>
      // Leave only compatible versions
      versioning.isCompatible(v.version, currentValue)
    );
    if (vulnerabilityAlert) {
      filteredVersions = filteredVersions.slice(0, 1);
    }
    const buckets: Record<string, [Release]> = {};
    for (const release of filteredVersions) {
      const bucket = getBucket(
        config,
        currentVersion,
        release.version,
        versioning
      );
      if (buckets[bucket]) {
        buckets[bucket].push(release);
      } else {
        buckets[bucket] = [release];
      }
    }
    for (const [bucket, bucketReleases] of Object.entries(buckets)) {
      const sortedReleases = bucketReleases.sort((r1, r2) =>
        versioning.sortVersions(r1.version, r2.version)
      );
      const bucketRelease = sortedReleases.pop();
      const newVersion = bucketRelease.version;
      const update: LookupUpdate = {
        currentVersion,
        newVersion,
        newValue: null,
      };
      update.bucket = bucket;
      try {
        update.newValue = versioning.getNewValue({
          currentValue,
          rangeStrategy,
          currentVersion,
          newVersion,
        });
      } catch (err) /* istanbul ignore next */ {
        logger.warn(
          { err, currentValue, rangeStrategy, currentVersion, newVersion },
          'getNewValue error'
        );
        update.newValue = currentValue;
      }
      if (!update.newValue || update.newValue === currentValue) {
        if (!config.lockedVersion) {
          continue; // eslint-disable-line no-continue
        }
        // istanbul ignore if
        if (rangeStrategy === 'bump') {
          logger.trace(
            { depName, currentValue, lockedVersion, newVersion },
            'Skipping bump because newValue is the same'
          );
          continue; // eslint-disable-line no-continue
        }
        update.currentVersion = lockedVersion;
        update.displayFrom = lockedVersion;
        update.displayTo = newVersion;
        update.isSingleVersion = true;
      }
      update.newMajor = versioning.getMajor(newVersion);
      update.newMinor = versioning.getMinor(newVersion);
      update.updateType =
        update.updateType || getType(config, currentVersion, newVersion);
      update.isSingleVersion =
        update.isSingleVersion || !!versioning.isSingleVersion(update.newValue);
      if (!versioning.isVersion(update.newValue)) {
        update.isRange = true;
      }
      const releaseFields = [
        'checksumUrl',
        'downloadUrl',
        'newDigest',
        'releaseTimestamp',
      ];
      releaseFields.forEach((field) => {
        if (bucketRelease[field] !== undefined) {
          update[field] = bucketRelease[field];
        }
      });
      if (sortedReleases.length) {
        update.skippedOverVersions = sortedReleases.map((r) => r.version);
      }
      if (
        rangeStrategy === 'update-lockfile' &&
        currentValue === update.newValue
      ) {
        update.isLockfileUpdate = true;
      }
      if (
        rangeStrategy === 'bump' &&
        versioning.matches(newVersion, currentValue)
      ) {
        update.isBump = true;
      }
      res.updates.push(update);
    }
  } else if (!currentValue) {
    res.skipReason = SkipReason.UnsupportedValue;
  } else {
    logger.debug(`Dependency ${depName} has unsupported value ${currentValue}`);
    if (!config.pinDigests && !config.currentDigest) {
      res.skipReason = SkipReason.UnsupportedValue;
    } else {
      delete res.skipReason;
    }
  }
  // Add digests if necessary
  if (config.newDigest || supportsDigests(config)) {
    if (
      config.currentDigest &&
      config.datasource !== datasourceGitSubmodules.id
    ) {
      if (!config.digestOneAndOnly || !res.updates.length) {
        // digest update
        res.updates.push({
          updateType: 'digest',
          newValue: config.currentValue,
        });
      }
    } else if (config.pinDigests) {
      // Create a pin only if one doesn't already exists
      if (!res.updates.some((update) => update.updateType === 'pin')) {
        // pin digest
        res.updates.push({
          updateType: 'pin',
          newValue: config.currentValue,
        });
      }
    } else if (config.datasource === datasourceGitSubmodules.id) {
      const dependency = clone(await getPkgReleases(config));
      if (dependency?.releases[0]?.version) {
        res.updates.push({
          updateType: 'digest',
          newValue: dependency.releases[0].version,
        });
      }
    }
    if (versioning.valueToVersion) {
      for (const update of res.updates || []) {
        update.newVersion = versioning.valueToVersion(update.newValue);
        update.currentVersion = versioning.valueToVersion(
          update.currentVersion
        );
        update.newVersion = versioning.valueToVersion(update.newVersion);
      }
    }
    // update digest for all
    for (const update of res.updates) {
      if (config.pinDigests || config.currentDigest) {
        update.newDigest =
          update.newDigest || (await getDigest(config, update.newValue));
        if (update.newDigest) {
          update.newDigestShort = update.newDigest
            .replace('sha256:', '')
            .substring(0, 7);
        } else {
          logger.debug({ newValue: update.newValue }, 'Could not getDigest');
        }
      }
    }
  }
  if (res.updates.length) {
    delete res.skipReason;
  }
  // Strip out any non-changed ones
  res.updates = res.updates
    .filter((update) => update.newDigest !== null)
    .filter(
      (update) =>
        update.newValue !== config.currentValue ||
        update.isLockfileUpdate ||
        (update.newDigest && !update.newDigest.startsWith(config.currentDigest))
    );
  if (res.updates.some((update) => update.updateType === 'pin')) {
    for (const update of res.updates) {
      if (
        update.updateType !== 'pin' &&
        update.updateType !== 'rollback' &&
        !vulnerabilityAlert
      ) {
        update.blockedByPin = true;
      }
    }
  }
  return res;
}
