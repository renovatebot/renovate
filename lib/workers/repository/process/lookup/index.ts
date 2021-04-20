import type { ValidationMessage } from '../../../../config/types';
import {
  Release,
  getDatasourceList,
  getDefaultVersioning,
  getDigest,
  getPkgReleases,
  isGetPkgReleasesConfig,
  supportsDigests,
} from '../../../../datasource';
import { logger } from '../../../../logger';
import { getRangeStrategy } from '../../../../manager';
import type { LookupUpdate } from '../../../../manager/types';
import { SkipReason } from '../../../../types';
import { clone } from '../../../../util/clone';
import { applyPackageRules } from '../../../../util/package-rules';
import * as allVersioning from '../../../../versioning';
import { getBucket } from './bucket';
import { getCurrentVersion } from './current';
import { filterVersions } from './filter';
import { getRollbackUpdate } from './rollback';
import type { LookupUpdateConfig, UpdateResult } from './types';
import { getUpdateType } from './update-type';

export async function lookupUpdates(
  inconfig: LookupUpdateConfig
): Promise<UpdateResult> {
  let config: LookupUpdateConfig = { ...inconfig };
  const {
    currentDigest,
    currentValue,
    datasource,
    depName,
    digestOneAndOnly,
    followTag,
    lockedVersion,
    packageFile,
    pinDigests,
    rollbackPrs,
    isVulnerabilityAlert,
  } = config;
  logger.trace({ dependency: depName, currentValue }, 'lookupUpdates');
  // Use the datasource's default versioning if none is configured
  const versioning = allVersioning.get(
    config.versioning || getDefaultVersioning(datasource)
  );
  const res: UpdateResult = { updates: [], warnings: [] } as any;
  // istanbul ignore if
  if (
    !isGetPkgReleasesConfig(config) ||
    !getDatasourceList().includes(datasource)
  ) {
    res.skipReason = SkipReason.InvalidConfig;
    return res;
  }
  const isValid = currentValue && versioning.isValid(currentValue);
  if (isValid) {
    const dependency = clone(await getPkgReleases(config));
    if (!dependency) {
      // If dependency lookup fails then warn and return
      const warning: ValidationMessage = {
        topic: depName,
        message: `Failed to look up dependency ${depName}`,
      };
      logger.debug({ dependency: depName, packageFile }, warning.message);
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
    const latestVersion = dependency.tags?.latest;
    // Filter out any results from datasource that don't comply with our versioning
    let allVersions = dependency.releases.filter((release) =>
      versioning.isVersion(release.version)
    );
    // istanbul ignore if
    if (allVersions.length === 0) {
      const message = `Found no results from datasource that look like a version`;
      logger.debug({ dependency: depName, result: dependency }, message);
      if (!currentDigest) {
        return res;
      }
    }
    // Reapply package rules in case we missed something from sourceUrl
    config = applyPackageRules({ ...config, sourceUrl: res.sourceUrl });
    if (followTag) {
      const taggedVersion = dependency.tags[followTag];
      if (!taggedVersion) {
        res.warnings.push({
          topic: depName,
          message: `Can't find version with tag ${followTag} for ${depName}`,
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
    if (rollbackPrs && !allSatisfyingVersions.length) {
      const rollback = getRollbackUpdate(config, allVersions);
      // istanbul ignore if
      if (!rollback) {
        res.warnings.push({
          topic: depName,
          message: `Can't find version matching ${currentValue} for ${depName}`,
        });
        return res;
      }
      res.updates.push(rollback);
    }
    let rangeStrategy = getRangeStrategy(config);
    // istanbul ignore next
    if (
      isVulnerabilityAlert &&
      rangeStrategy === 'update-lockfile' &&
      !lockedVersion
    ) {
      rangeStrategy = 'bump';
    }
    const nonDeprecatedVersions = dependency.releases
      .filter((release) => !release.isDeprecated)
      .map((release) => release.version);
    const currentVersion =
      getCurrentVersion(
        config,
        versioning,
        rangeStrategy,
        latestVersion,
        nonDeprecatedVersions
      ) ||
      getCurrentVersion(
        config,
        versioning,
        rangeStrategy,
        latestVersion,
        allVersions.map((v) => v.version)
      );
    res.currentVersion = currentVersion;
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
    let filteredReleases = filterVersions(
      config,
      filterStart,
      latestVersion,
      allVersions
    ).filter((v) =>
      // Leave only compatible versions
      versioning.isCompatible(v.version, currentValue)
    );
    if (isVulnerabilityAlert) {
      filteredReleases = filteredReleases.slice(0, 1);
    }
    const buckets: Record<string, [Release]> = {};
    for (const release of filteredReleases) {
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
    for (const [bucket, releases] of Object.entries(buckets)) {
      const sortedReleases = releases.sort((r1, r2) =>
        versioning.sortVersions(r1.version, r2.version)
      );
      const release = sortedReleases.pop();
      const newVersion = release.version;
      const update: LookupUpdate = {
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
        if (!lockedVersion) {
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
        res.isSingleVersion = true;
      }
      update.newMajor = versioning.getMajor(newVersion);
      update.newMinor = versioning.getMinor(newVersion);
      update.updateType =
        update.updateType ||
        getUpdateType(config, versioning, currentVersion, newVersion);
      res.isSingleVersion =
        res.isSingleVersion || !!versioning.isSingleVersion(update.newValue);
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
        if (release[field] !== undefined) {
          update[field] = release[field];
        }
      });
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
  } else if (currentValue) {
    logger.debug(`Dependency ${depName} has unsupported value ${currentValue}`);
    if (!pinDigests && !currentDigest) {
      res.skipReason = SkipReason.InvalidValue;
    } else {
      delete res.skipReason;
    }
  } else {
    res.skipReason = SkipReason.InvalidValue;
  }

  // Record if the dep is fixed to a version
  if (lockedVersion) {
    res.currentVersion = lockedVersion;
    res.fixedVersion = lockedVersion;
  } else if (currentValue && versioning.isSingleVersion(currentValue)) {
    res.fixedVersion = currentValue.replace(/^=+/, '');
  }
  // Add digests if necessary
  if (supportsDigests(config)) {
    if (currentDigest) {
      if (!digestOneAndOnly || !res.updates.length) {
        // digest update
        res.updates.push({
          updateType: 'digest',
          newValue: currentValue,
        });
      }
    } else if (pinDigests) {
      // Create a pin only if one doesn't already exists
      if (!res.updates.some((update) => update.updateType === 'pin')) {
        // pin digest
        res.updates.push({
          updateType: 'pin',
          newValue: currentValue,
        });
      }
    }
    if (versioning.valueToVersion) {
      res.currentVersion = versioning.valueToVersion(res.currentVersion);
      for (const update of res.updates || []) {
        update.newVersion = versioning.valueToVersion(update.newVersion);
      }
    }
    // update digest for all
    for (const update of res.updates) {
      if (pinDigests || currentDigest) {
        update.newDigest =
          update.newDigest || (await getDigest(config, update.newValue));
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
        update.newValue !== currentValue ||
        update.isLockfileUpdate ||
        (update.newDigest && !update.newDigest.startsWith(currentDigest))
    );
  return res;
}
