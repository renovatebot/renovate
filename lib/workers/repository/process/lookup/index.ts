import is from '@sindresorhus/is';
import { mergeChildConfig } from '../../../../config';
import type { ValidationMessage } from '../../../../config/types';
import { CONFIG_VALIDATION } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import {
  Release,
  ReleaseResult,
  applyDatasourceFilters,
  getDigest,
  getRawPkgReleases,
  isGetPkgReleasesConfig,
  supportsDigests,
} from '../../../../modules/datasource';
import {
  getDatasourceFor,
  getDefaultVersioning,
} from '../../../../modules/datasource/common';
import { getRangeStrategy } from '../../../../modules/manager';
import * as allVersioning from '../../../../modules/versioning';
import { ExternalHostError } from '../../../../types/errors/external-host-error';
import { assignKeys } from '../../../../util/assign-keys';
import { applyPackageRules } from '../../../../util/package-rules';
import { regEx } from '../../../../util/regex';
import { getBucket } from './bucket';
import { getCurrentVersion } from './current';
import { filterVersions } from './filter';
import { filterInternalChecks } from './filter-checks';
import { generateUpdate } from './generate';
import { getRollbackUpdate } from './rollback';
import type { LookupUpdateConfig, UpdateResult } from './types';
import {
  addReplacementUpdateIfValid,
  isReplacementRulesConfigured,
} from './utils';

export async function lookupUpdates(
  inconfig: LookupUpdateConfig
): Promise<UpdateResult> {
  let config: LookupUpdateConfig = { ...inconfig };
  const {
    currentDigest,
    currentValue,
    datasource,
    digestOneAndOnly,
    followTag,
    lockedVersion,
    packageFile,
    packageName,
    pinDigests,
    rollbackPrs,
    isVulnerabilityAlert,
    updatePinnedDependencies,
  } = config;
  config.versioning ??= getDefaultVersioning(datasource);

  const versioning = allVersioning.get(config.versioning);
  const unconstrainedValue = !!lockedVersion && is.undefined(currentValue);

  let dependency: ReleaseResult | null = null;
  const res: UpdateResult = {
    versioning: config.versioning,
    updates: [],
    warnings: [],
  };

  try {
    logger.trace({ dependency: packageName, currentValue }, 'lookupUpdates');
    // istanbul ignore if
    if (!isGetPkgReleasesConfig(config) || !getDatasourceFor(datasource)) {
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

      const { val: releaseResult, err: lookupError } = await getRawPkgReleases(
        config
      )
        .transform((res) => applyDatasourceFilters(res, config))
        .unwrap();

      if (lookupError instanceof Error) {
        throw lookupError;
      }

      if (lookupError) {
        // If dependency lookup fails then warn and return
        const warning: ValidationMessage = {
          topic: packageName,
          message: `Failed to look up ${datasource} package ${packageName}`,
        };
        logger.debug({ dependency: packageName, packageFile }, warning.message);
        // TODO: return warnings in own field
        res.warnings.push(warning);
        return res;
      }

      dependency = releaseResult;

      if (dependency.deprecationMessage) {
        logger.debug(
          `Found deprecationMessage for ${datasource} package ${packageName}`
        );
      }

      assignKeys(res, dependency, [
        'deprecationMessage',
        'sourceUrl',
        'registryUrl',
        'sourceDirectory',
        'homepage',
        'changelogUrl',
        'dependencyUrl',
      ]);

      const latestVersion = dependency.tags?.latest;
      // Filter out any results from datasource that don't comply with our versioning
      let allVersions = dependency.releases.filter((release) =>
        versioning.isVersion(release.version)
      );

      // istanbul ignore if
      if (allVersions.length === 0) {
        const message = `Found no results from datasource that look like a version`;
        logger.debug({ dependency: packageName, result: dependency }, message);
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
            topic: packageName,
            message: `Can't find version with tag ${followTag} for ${datasource} package ${packageName}`,
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
            topic: packageName,
            // TODO: types (#7154)
            message: `Can't find version matching ${currentValue!} for ${datasource} package ${packageName}`,
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
      if (rangeStrategy === 'pin') {
        // Fall back to replace once pinning logic is done
        rangeStrategy = 'replace';
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
        config.rangeStrategy === 'in-range-only'
          ? allSatisfyingVersions
          : allVersions,
        versioning
      ).filter(
        (v) =>
          // Leave only compatible versions
          unconstrainedValue || versioning.isCompatible(v.version, currentValue)
      );
      if (isVulnerabilityAlert && !config.osvVulnerabilityAlerts) {
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
        const update = await generateUpdate(
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
              { packageName, currentValue, lockedVersion, newVersion },
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
        `Dependency ${packageName} has unsupported/unversioned value ${currentValue} (versioning=${config.versioning})`
      );

      if (!pinDigests && !currentDigest) {
        res.skipReason = 'invalid-value';
      } else {
        delete res.skipReason;
      }
    } else {
      res.skipReason = 'invalid-value';
    }

    if (isReplacementRulesConfigured(config)) {
      addReplacementUpdateIfValid(res.updates, config);
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
        for (const update of res.updates || /* istanbul ignore next*/ []) {
          // TODO #7154
          update.newVersion = versioning.valueToVersion(update.newVersion!);
        }
      }
      // update digest for all
      for (const update of res.updates) {
        if (pinDigests === true || currentDigest) {
          // TODO #7154
          update.newDigest =
            update.newDigest ?? (await getDigest(config, update.newValue))!;

          // If the digest could not be determined, report this as otherwise the
          // update will be omitted later on without notice.
          if (update.newDigest === null) {
            logger.debug(
              {
                packageName,
                currentValue,
                datasource,
                newValue: update.newValue,
                bucket: update.bucket,
              },
              'Could not determine new digest for update.'
            );

            // Only report a warning if there is a current digest.
            // Context: https://github.com/renovatebot/renovate/pull/20175#discussion_r1102615059.
            if (currentDigest) {
              res.warnings.push({
                message: `Could not determine new digest for update (datasource: ${datasource})`,
                topic: packageName,
              });
            }
          }
        }
        if (update.newVersion) {
          const registryUrl = dependency?.releases?.find(
            (release) => release.version === update.newVersion
          )?.registryUrl;
          if (registryUrl && registryUrl !== res.registryUrl) {
            update.registryUrl = registryUrl;
          }
        }
      }
    }
    if (res.updates.length) {
      delete res.skipReason;
    }
    // Strip out any non-changed ones
    res.updates = res.updates
      .filter((update) => update.newValue !== null || currentValue === null)
      .filter((update) => update.newDigest !== null)
      .filter(
        (update) =>
          (is.string(update.newName) && update.newName !== packageName) ||
          update.isReplacement === true ||
          update.newValue !== currentValue ||
          update.isLockfileUpdate === true ||
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
        (update) =>
          res.updates.length === 1 ||
          /* istanbul ignore next */ update.updateType !== 'rollback'
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
        packageName,
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
