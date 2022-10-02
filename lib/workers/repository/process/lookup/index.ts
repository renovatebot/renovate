import is from '@sindresorhus/is';
import { mergeChildConfig } from '../../../../config';
import type { ValidationMessage } from '../../../../config/types';
import { CONFIG_VALIDATION } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import {
  Release,
  getDatasourceList,
  getDefaultVersioning,
  getDigest,
  getPkgReleases,
  isGetPkgReleasesConfig,
  supportsDigests,
} from '../../../../modules/datasource';
import { getRangeStrategy } from '../../../../modules/manager';
import * as allVersioning from '../../../../modules/versioning';
import { ExternalHostError } from '../../../../types/errors/external-host-error';
import { clone } from '../../../../util/clone';
import { applyPackageRules } from '../../../../util/package-rules';
import { regEx } from '../../../../util/regex';
import { getBucket } from './bucket';
import { mergeConfigConstraints } from './common';
import { getCurrentVersion } from './current';
import { filterVersions } from './filter';
import { filterInternalChecks } from './filter-checks';
import { generateUpdate } from './generate';
import { getRollbackUpdate } from './rollback';
import type { LookupUpdateConfig, UpdateResult } from './types';

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
    updatePinnedDependencies,
  } = config;
  const unconstrainedValue = !!lockedVersion && is.undefined(currentValue);
  const res: UpdateResult = {
    updates: [],
    warnings: [],
  } as any;
  try {
    logger.trace({ dependency: depName, currentValue }, 'lookupUpdates');
    // Use the datasource's default versioning if none is configured
    config.versioning ??= getDefaultVersioning(datasource);
    const versioning = allVersioning.get(config.versioning);
    res.versioning = config.versioning;
    // istanbul ignore if
    if (
      !isGetPkgReleasesConfig(config) ||
      !getDatasourceList().includes(datasource)
    ) {
      res.skipReason = 'invalid-config';
      return res;
    }
    const isValid = is.string(currentValue) && versioning.isValid(currentValue);
    if (unconstrainedValue || isValid) {
      if (
        !updatePinnedDependencies &&
        // TODO #7154
        versioning.isSingleVersion(currentValue!)
      ) {
        res.skipReason = 'is-pinned';
        return res;
      }

      config = mergeConfigConstraints(config);

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
        const taggedVersion = dependency.tags?.[followTag];
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
      const allSatisfyingVersions = allVersions.filter(
        (v) =>
          // TODO #7154
          unconstrainedValue || versioning.matches(v.version, currentValue!)
      );
      if (rollbackPrs && !allSatisfyingVersions.length) {
        const rollback = getRollbackUpdate(config, allVersions, versioning);
        // istanbul ignore if
        if (!rollback) {
          res.warnings.push({
            topic: depName,
            // TODO: types (#7154)
            message: `Can't find version matching ${currentValue!} for ${depName}`,
          });
          return res;
        }
        res.updates.push(rollback);
      }
      let rangeStrategy = getRangeStrategy(config);
      if (dependency.replacementName && dependency.replacementVersion) {
        res.updates.push({
          updateType: 'replacement',
          newName: dependency.replacementName,
          newValue: versioning.getNewValue({
            // TODO #7154
            currentValue: currentValue!,
            newVersion: dependency.replacementVersion,
            rangeStrategy: rangeStrategy!,
          })!,
        });
      }
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
      let currentVersion: string;
      if (rangeStrategy === 'update-lockfile') {
        currentVersion = lockedVersion!;
      }
      // TODO #7154
      currentVersion ??=
        getCurrentVersion(
          currentValue!,
          lockedVersion!,
          versioning,
          rangeStrategy!,
          latestVersion!,
          nonDeprecatedVersions
        ) ??
        getCurrentVersion(
          currentValue!,
          lockedVersion!,
          versioning,
          rangeStrategy!,
          latestVersion!,
          allVersions.map((v) => v.version)
        )!;
      // istanbul ignore if
      if (!currentVersion! && lockedVersion) {
        return res;
      }
      res.currentVersion = currentVersion!;
      if (
        currentValue &&
        currentVersion &&
        rangeStrategy === 'pin' &&
        !versioning.isSingleVersion(currentValue)
      ) {
        res.updates.push({
          updateType: 'pin',
          isPin: true,
          // TODO: newValue can be null! (#7154)
          newValue: versioning.getNewValue({
            currentValue,
            rangeStrategy,
            currentVersion,
            newVersion: currentVersion,
          })!,
          newVersion: currentVersion,
          newMajor: versioning.getMajor(currentVersion)!,
        });
      }
      // istanbul ignore if
      if (!versioning.isVersion(currentVersion!)) {
        res.skipReason = 'invalid-version';
        return res;
      }
      // Filter latest, unstable, etc
      // TODO #7154
      let filteredReleases = filterVersions(
        config,
        currentVersion!,
        latestVersion!,
        allVersions,
        versioning
      ).filter(
        (v) =>
          // Leave only compatible versions
          unconstrainedValue || versioning.isCompatible(v.version, currentValue)
      );
      if (isVulnerabilityAlert) {
        filteredReleases = filteredReleases.slice(0, 1);
      }
      const buckets: Record<string, [Release]> = {};
      for (const release of filteredReleases) {
        const bucket = getBucket(
          config,
          // TODO #7154
          currentVersion!,
          release.version,
          versioning
        );
        if (is.string(bucket)) {
          if (buckets[bucket]) {
            buckets[bucket].push(release);
          } else {
            buckets[bucket] = [release];
          }
        }
      }
      const depResultConfig = mergeChildConfig(config, res);
      for (const [bucket, releases] of Object.entries(buckets)) {
        const sortedReleases = releases.sort((r1, r2) =>
          versioning.sortVersions(r1.version, r2.version)
        );
        const { release, pendingChecks, pendingReleases } =
          await filterInternalChecks(
            depResultConfig,
            versioning,
            bucket,
            sortedReleases
          );
        // istanbul ignore next
        if (!release) {
          return res;
        }
        const newVersion = release.version;
        const update = generateUpdate(
          config,
          versioning,
          // TODO #7154

          rangeStrategy!,
          lockedVersion ?? currentVersion!,
          bucket,
          release
        );
        if (pendingChecks) {
          update.pendingChecks = pendingChecks;
        }

        // TODO #7154
        if (pendingReleases!.length) {
          update.pendingVersions = pendingReleases!.map((r) => r.version);
        }
        if (!update.newValue || update.newValue === currentValue) {
          if (!lockedVersion) {
            continue;
          }
          // istanbul ignore if
          if (rangeStrategy === 'bump') {
            logger.trace(
              { depName, currentValue, lockedVersion, newVersion },
              'Skipping bump because newValue is the same'
            );
            continue;
          }
          res.isSingleVersion = true;
        }
        res.isSingleVersion =
          !!res.isSingleVersion ||
          !!versioning.isSingleVersion(update.newValue);

        res.updates.push(update);
      }
    } else if (currentValue) {
      logger.debug(
        `Dependency ${depName} has unsupported value ${currentValue}`
      );
      if (!pinDigests && !currentDigest) {
        res.skipReason = 'invalid-value';
      } else {
        delete res.skipReason;
      }
    } else {
      res.skipReason = 'invalid-value';
    }

    // Record if the dep is fixed to a version
    if (lockedVersion) {
      res.currentVersion = lockedVersion;
      res.fixedVersion = lockedVersion;
    } else if (currentValue && versioning.isSingleVersion(currentValue)) {
      res.fixedVersion = currentValue.replace(regEx(/^=+/), '');
    }
    // Add digests if necessary
    if (supportsDigests(config.datasource)) {
      if (currentDigest) {
        if (!digestOneAndOnly || !res.updates.length) {
          // digest update
          res.updates.push({
            updateType: 'digest',
            // TODO #7154
            newValue: currentValue!,
          });
        }
      } else if (pinDigests) {
        // Create a pin only if one doesn't already exists
        if (!res.updates.some((update) => update.updateType === 'pin')) {
          // pin digest
          res.updates.push({
            isPinDigest: true,
            updateType: 'pinDigest',
            // TODO #7154
            newValue: currentValue!,
          });
        }
      }
      if (versioning.valueToVersion) {
        // TODO #7154
        res.currentVersion = versioning.valueToVersion(res.currentVersion!);
        for (const update of res.updates || []) {
          // TODO #7154
          update.newVersion = versioning.valueToVersion(update.newVersion!);
        }
      }
      // update digest for all
      for (const update of res.updates) {
        if (pinDigests || currentDigest) {
          // TODO #7154
          update.newDigest =
            update.newDigest ?? (await getDigest(config, update.newValue))!;
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
          // TODO #7154
          (update.newDigest && !update.newDigest.startsWith(currentDigest!))
      );
    // If range strategy specified in config is 'in-range-only', also strip out updates where currentValue !== newValue
    if (config.rangeStrategy === 'in-range-only') {
      res.updates = res.updates.filter(
        (update) => update.newValue === currentValue
      );
    }
    // Handle a weird edge case involving followTag and fallbacks
    if (rollbackPrs && followTag) {
      res.updates = res.updates.filter(
        (update) => res.updates.length === 1 || update.updateType !== 'rollback'
      );
    }
  } catch (err) /* istanbul ignore next */ {
    if (err instanceof ExternalHostError || err.message === CONFIG_VALIDATION) {
      throw err;
    }
    logger.error(
      {
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
        updatePinnedDependencies,
        unconstrainedValue,
        err,
      },
      'lookupUpdates error'
    );
    res.skipReason = 'internal-error';
  }
  return res;
}
