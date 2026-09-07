import { isNonEmptyString, isString, isUndefined } from '@sindresorhus/is';
import { mergeChildConfig } from '../../../../config/index.ts';
import type { ValidationMessage } from '../../../../config/types.ts';
import { CONFIG_VALIDATION } from '../../../../constants/error-messages.ts';
import { logger } from '../../../../logger/index.ts';
import {
  getDatasourceFor,
  getDefaultVersioning,
} from '../../../../modules/datasource/common.ts';
import type {
  Release,
  ReleaseResult,
} from '../../../../modules/datasource/index.ts';
import {
  applyDatasourceFilters,
  getRawPkgReleases,
  isGetPkgReleasesConfig,
  supportsDigests,
} from '../../../../modules/datasource/index.ts';
import { postprocessRelease } from '../../../../modules/datasource/postprocess-release.ts';
import { id as dockerVersioningId } from '../../../../modules/versioning/docker/index.ts';
import * as allVersioning from '../../../../modules/versioning/index.ts';
import { ExternalHostError } from '../../../../types/errors/external-host-error.ts';
import { assignKeys } from '../../../../util/assign-keys.ts';
import { getElapsedDays } from '../../../../util/date.ts';
import { applyPackageRules } from '../../../../util/package-rules/index.ts';
import { regEx } from '../../../../util/regex.ts';
import { Result } from '../../../../util/result.ts';
import type { Timestamp } from '../../../../util/timestamp.ts';
import { calculateAbandonment } from './abandonment.ts';
import { groupReleasesIntoBuckets } from './bucket.ts';
import { getNewestMatchingVersion, resolveCurrentVersion } from './current.ts';
import type { DigestLikeUpdate } from './digest.ts';
import {
  applyMinimumReleaseAgeToDigestUpdate,
  couldApplyMinimumReleaseAgeToDigest,
  resolveUpdateDigests,
} from './digest.ts';
import { filterVersions } from './filter.ts';
import { filterInternalChecks } from './filter-checks.ts';
import { generateUpdate } from './generate.ts';
import { resolveRangeStrategy } from './range-strategy.ts';
import { getRollbackUpdate } from './rollback.ts';
import { calculateMostRecentTimestamp } from './timestamps.ts';
import type { LookupUpdateConfig, UpdateResult } from './types.ts';
import {
  addReplacementUpdateIfValid,
  isReplacementRulesConfigured,
  stripNoopUpdates,
} from './utils.ts';
import {
  matchVersionCompatibility,
  restoreVersionCompatibility,
} from './version-compatibility.ts';
import { applyVulnerabilityFixFilter } from './vulnerability.ts';

async function getTimestamp(
  config: LookupUpdateConfig,
  versions: Release[],
  version: string,
  versioningApi: allVersioning.VersioningApi,
): Promise<Timestamp | null | undefined> {
  const currentRelease = versions.find(
    (v) =>
      versioningApi.isValid(v.version) &&
      versioningApi.equals(v.version, version),
  );

  if (!currentRelease) {
    return null;
  }

  if (currentRelease.releaseTimestamp) {
    return currentRelease.releaseTimestamp;
  }

  const remoteRelease = await postprocessRelease(config, currentRelease);
  return remoteRelease?.releaseTimestamp;
}

export async function lookupUpdates(
  inconfig: LookupUpdateConfig,
): Promise<Result<UpdateResult>> {
  let config: LookupUpdateConfig = { ...inconfig };
  config.versioning ??= getDefaultVersioning(config.datasource);

  const versioningApi = allVersioning.get(config.versioning);

  let dependency: ReleaseResult | null = null;
  const res: UpdateResult = {
    versioning: config.versioning,
    updates: [],
    warnings: [],
  };
  // Timestamp of the release a `digest`/`pinDigest` update's current value currently resolves to (the newest version matching it, regardless of `rangeStrategy`), as opposed to `res.currentVersionTimestamp` which tracks whatever the configured rangeStrategy resolves `currentVersion` to (e.g. the oldest for `bump`)
  let newestMatchingVersionTimestamp: Timestamp | null | undefined;
  // The `digest` update for `config.currentDigest` (if one is added), so its age check can run after `newDigest` is fetched and no-op updates are stripped.
  let digestUpdate: DigestLikeUpdate | undefined;

  try {
    logger.trace(
      {
        dependency: config.packageName,
        currentValue: config.currentValue,
      },
      'lookupUpdates',
    );
    if (config.currentValue && !isString(config.currentValue)) {
      // If currentValue is not a string, then it's invalid
      // v8 ignore else -- TODO: add test #40625
      if (config.currentValue) {
        logger.debug(
          `Invalid currentValue for ${config.packageName}: ${JSON.stringify(config.currentValue)} (${typeof config.currentValue})`,
        );
      }
      res.skipReason = 'invalid-value';
      return Result.ok(res);
    }
    if (
      !isGetPkgReleasesConfig(config) ||
      !getDatasourceFor(config.datasource)
    ) {
      res.skipReason = 'invalid-config';
      return Result.ok(res);
    }
    let compareValue = config.currentValue;
    const versionCompatibilityMatch = matchVersionCompatibility(config);
    if (versionCompatibilityMatch) {
      compareValue = versionCompatibilityMatch.compareValue;
      config.currentCompatibility =
        versionCompatibilityMatch.currentCompatibility;
      res.currentCompatibility = versionCompatibilityMatch.currentCompatibility;
    }

    const isValid =
      isString(compareValue) && versioningApi.isValid(compareValue);

    const unconstrainedValue =
      !!config.lockedVersion && isUndefined(config.currentValue);

    if (isValid || unconstrainedValue) {
      if (
        !config.updatePinnedDependencies &&
        // TODO #22198
        versioningApi.isSingleVersion(compareValue!)
      ) {
        res.skipReason = 'is-pinned';
        return Result.ok(res);
      }

      const { val: releaseResult, err: lookupError } = await getRawPkgReleases(
        config,
      )
        .transform((res) => calculateMostRecentTimestamp(versioningApi, res))
        .transform((res) => calculateAbandonment(res, config))
        .transform((res) => applyDatasourceFilters(res, config))
        .unwrap();

      if (lookupError instanceof Error) {
        throw lookupError;
      }

      if (lookupError) {
        // If dependency lookup fails then warn and return
        const warning: ValidationMessage = {
          topic: config.packageName,
          message: `Failed to look up ${config.datasource} package ${config.packageName}: ${lookupError}`,
        };
        logger.debug(
          {
            dependency: config.packageName,
            packageFile: config.packageFile,
          },
          warning.message,
        );
        // TODO: return warnings in own field
        res.warnings.push(warning);
        return Result.ok(res);
      }

      dependency = releaseResult;

      if (dependency.deprecationMessage) {
        logger.debug(
          `Found deprecationMessage for ${config.datasource} package ${config.packageName}`,
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
        'lookupName',
        'packageScope',
        'mostRecentTimestamp',
        'isAbandoned',
        'respectLatest',
      ]);

      const latestVersion = dependency.tags?.latest;
      // Filter out any results from datasource that don't comply with our versioning
      let allVersions = dependency.releases.filter((release) =>
        versioningApi.isVersion(release.version),
      );
      const allReleaseVersions = new Set(allVersions.map((r) => r.version));
      // istanbul ignore if
      if (allVersions.length === 0) {
        const message = `Found no results from datasource that look like a version`;
        logger.info(
          {
            dependency: config.packageName,
            result: dependency,
          },
          message,
        );
        if (!config.currentDigest) {
          return Result.ok(res);
        }
      }
      // Reapply package rules in case we missed something from sourceUrl
      config = await applyPackageRules(
        { ...config, sourceUrl: res.sourceUrl },
        'source-url',
      );
      if (config.followTag) {
        const taggedVersion = dependency.tags?.[config.followTag];
        if (!taggedVersion) {
          res.warnings.push({
            topic: config.packageName,
            message: `Can't find version with tag ${config.followTag} for ${config.datasource} package ${config.packageName}`,
          });
          return Result.ok(res);
        }
        allVersions = allVersions.filter(
          (v) =>
            v.version === taggedVersion ||
            (v.version === compareValue &&
              versioningApi.isGreaterThan(taggedVersion, compareValue)),
        );
      }

      const inRangeOnlyStrategy = config.rangeStrategy === 'in-range-only';
      // Check that existing constraint can be satisfied
      const allSatisfyingVersions =
        (inRangeOnlyStrategy || config.rollbackPrs) && !unconstrainedValue
          ? allVersions.filter((v) =>
              // TODO #22198
              versioningApi.matches(v.version, compareValue!),
            )
          : allVersions;
      if (!allSatisfyingVersions.length) {
        logger.debug(
          `Found no satisfying versions with '${config.versioning}' versioning`,
        );
      }

      if (config.rollbackPrs && !allSatisfyingVersions.length) {
        const rollback = getRollbackUpdate(config, allVersions, versioningApi);
        // istanbul ignore if
        if (!rollback) {
          res.warnings.push({
            topic: config.packageName,
            // TODO: types (#22198)
            message: `Can't find version matching ${compareValue!} for ${
              config.datasource
            } package ${config.packageName}`,
          });
          return Result.ok(res);
        }
        res.updates.push(rollback);
      }
      let rangeStrategy = resolveRangeStrategy(config);

      const currentVersion = resolveCurrentVersion(
        compareValue,
        config.lockedVersion,
        versioningApi,
        rangeStrategy,
        latestVersion,
        allVersions.map((v) => v.version),
        dependency.releases
          .filter((release) => !release.isDeprecated)
          .map((release) => release.version),
      );

      if (!currentVersion) {
        // v8 ignore else -- TODO: add test #40625
        if (!config.lockedVersion) {
          logger.debug(
            `No currentVersion or lockedVersion found for ${config.packageName}`,
          );
          res.skipReason = 'invalid-value';
        }
        return Result.ok(res);
      }

      res.currentVersion = currentVersion;

      // Use lockedVersion for the timestamp lookup when available, because
      // res.currentVersion is later overwritten to lockedVersion (see below).
      // Without this, strategies like "replace" would compute the timestamp
      // for the highest satisfying version (e.g. 1.4.1) while the reported
      // currentVersion ends up being the locked one (e.g. 1.0.0).
      const versionForTimestamp = config.lockedVersion ?? currentVersion;
      const currentVersionTimestamp = await getTimestamp(
        config,
        allVersions,
        versionForTimestamp,
        versioningApi,
      );

      if (isNonEmptyString(currentVersionTimestamp)) {
        res.currentVersionTimestamp = currentVersionTimestamp;
        res.currentVersionAgeInDays = getElapsedDays(currentVersionTimestamp);

        if (
          config.packageRules?.some((rule) =>
            isNonEmptyString(rule.matchCurrentAge),
          )
        ) {
          // Reapply package rules to check matches for matchCurrentAge
          config = await applyPackageRules(
            { ...config, currentVersionTimestamp },
            'current-timestamp',
          );
        }
      }

      if (
        config.currentDigest
          ? couldApplyMinimumReleaseAgeToDigest(config, 'digest')
          : config.pinDigests &&
            couldApplyMinimumReleaseAgeToDigest(config, 'pinDigest')
      ) {
        const newestMatchingVersion = getNewestMatchingVersion(
          compareValue,
          versioningApi,
          latestVersion,
          allVersions,
        );
        if (newestMatchingVersion) {
          newestMatchingVersionTimestamp = await getTimestamp(
            config,
            allVersions,
            newestMatchingVersion,
            versioningApi,
          );
        }
      }

      if (
        compareValue &&
        currentVersion &&
        rangeStrategy === 'pin' &&
        !versioningApi.isSingleVersion(compareValue)
      ) {
        const newValue =
          versioningApi.getPinnedValue?.(currentVersion) ?? currentVersion;
        res.updates.push({
          updateType: 'pin',
          isPin: true,
          newValue,
          newVersion: currentVersion,
          newMajor: versioningApi.getMajor(currentVersion)!,
        });
      }
      if (rangeStrategy === 'pin') {
        // Fall back to replace once pinning logic is done
        rangeStrategy = 'replace';
      }
      // istanbul ignore if
      if (!versioningApi.isVersion(currentVersion)) {
        res.skipReason = 'invalid-version';
        return Result.ok(res);
      }
      // Filter latest, unstable, etc
      // TODO #22198
      let filteredReleases = filterVersions(
        config,
        currentVersion,
        latestVersion!,
        inRangeOnlyStrategy ? allSatisfyingVersions : allVersions,
        versioningApi,
      ).filter(
        (v) =>
          // Leave only compatible versions
          unconstrainedValue ||
          versioningApi.isCompatible(v.version, compareValue),
      );
      const vulnerabilityFix = applyVulnerabilityFixFilter(
        config,
        res,
        versioningApi,
        filteredReleases,
      );
      filteredReleases = vulnerabilityFix.releases;
      const { shrinkedViaVulnerability } = vulnerabilityFix;

      const buckets = groupReleasesIntoBuckets(
        config,
        currentVersion,
        filteredReleases,
        versioningApi,
      );
      const depResultConfig = mergeChildConfig(config, res);
      for (const [bucket, releases] of Object.entries(buckets)) {
        const sortedReleases = releases.sort((r1, r2) =>
          versioningApi.sortVersions(r1.version, r2.version),
        );
        const { release, pendingChecks, pendingReleases } =
          await filterInternalChecks(
            depResultConfig,
            versioningApi,
            bucket,
            sortedReleases,
          );
        // istanbul ignore next
        if (!release) {
          return Result.ok(res);
        }
        const newVersion = release.version;
        const update = await generateUpdate(
          config,
          compareValue,
          versioningApi,
          // TODO #22198

          rangeStrategy!,
          config.lockedVersion ?? currentVersion,
          bucket,
          release,
          allReleaseVersions,
        );

        // #29034
        if (
          config.manager === 'gomod' &&
          compareValue?.startsWith('v0.0.0-') &&
          update.newValue?.startsWith('v0.0.0-') &&
          config.currentDigest !== update.newDigest
        ) {
          update.updateType = 'digest';

          // As this has already been processed by `filterInternalChecks()`, but we're changing the `updateType`, we need to apply the digest-scoped minimumReleaseAge rules.
          // `currentVersionWasResolved` only matters for `pinDigest`, which `update.updateType` never is here - true is a safe constant.
          await applyMinimumReleaseAgeToDigestUpdate(
            update as DigestLikeUpdate,
            config,
            res,
            true,
            release.releaseTimestamp,
          );
        }

        if (pendingChecks) {
          update.pendingChecks = pendingChecks;
        }

        if (pendingReleases.length) {
          update.pendingVersions = pendingReleases.map((r) => r.version);
        }
        if (!update.newValue || update.newValue === compareValue) {
          if (!config.lockedVersion) {
            continue;
          }
          // istanbul ignore if
          if (rangeStrategy === 'bump') {
            logger.trace(
              {
                packageName: config.packageName,
                currentValue: config.currentValue,
                lockedVersion: config.lockedVersion,
                newVersion,
              },
              'Skipping bump because newValue is the same',
            );
            continue;
          }
          res.isSingleVersion = true;
        }
        res.isSingleVersion ??=
          isString(update.newValue) &&
          versioningApi.isSingleVersion(update.newValue);
        // istanbul ignore if
        if (
          config.versioning === dockerVersioningId &&
          update.updateType !== 'rollback' &&
          update.newValue &&
          versioningApi.isVersion(update.newValue) &&
          compareValue &&
          versioningApi.isVersion(compareValue) &&
          versioningApi.isGreaterThan(compareValue, update.newValue)
        ) {
          logger.warn(
            {
              packageName: config.packageName,
              currentValue: config.currentValue,
              compareValue,
              currentVersion: config.currentVersion,
              update,
              allVersionsLength: allVersions.length,
              filteredReleaseVersions: filteredReleases.map((r) => r.version),
              shrinkedViaVulnerability,
            },
            'Unexpected downgrade detected: skipping',
          );
        } else {
          res.updates.push(update);
        }
      }
    } else if (compareValue) {
      logger.debug(
        `Dependency ${config.packageName} has unsupported/unversioned value ${compareValue} (versioning=${config.versioning})`,
      );

      if (!config.pinDigests && !config.currentDigest) {
        logger.debug(
          `Skipping ${config.packageName} because no currentDigest or pinDigests`,
        );
        res.skipReason = 'invalid-value';
      } else {
        delete res.skipReason;
      }
    } else {
      res.skipReason = 'invalid-value';
    }

    if (isReplacementRulesConfigured(config)) {
      addReplacementUpdateIfValid(res.updates, config);
    } else if (dependency?.replacementName && dependency.replacementVersion) {
      res.updates.push({
        updateType: 'replacement',
        newName: dependency.replacementName,
        newValue: dependency.replacementVersion,
      });
    }

    // Record if the dep is fixed to a version
    if (config.lockedVersion) {
      res.currentVersion = config.lockedVersion;
      res.fixedVersion = config.lockedVersion;
    } else if (compareValue && versioningApi.isSingleVersion(compareValue)) {
      res.fixedVersion = compareValue.replace(regEx(/^=+/), '');
    }

    // massage versionCompatibility
    restoreVersionCompatibility(config, compareValue, res.updates);

    // Add digests if necessary
    if (supportsDigests(config.datasource)) {
      if (config.currentDigest) {
        if (!config.digestOneAndOnly || !res.updates.length) {
          // digest update - age-checked after the strip below, once newDigest is known
          digestUpdate = {
            updateType: 'digest',
            newValue: config.currentValue,
          };
          res.updates.push(digestUpdate);
        }
      } else if (
        config.pinDigests &&
        // only update the digest in the package file if it's managed by us
        !config.digestManagedExternally &&
        // Create a pin only if one doesn't already exists
        // v8 ignore else -- TODO: add test #40625
        !res.updates.some((update) => update.updateType === 'pin')
      ) {
        // pin digest
        const pinDigestUpdate: DigestLikeUpdate = {
          isPinDigest: true,
          updateType: 'pinDigest',
          newValue: config.currentValue,
        };
        await applyMinimumReleaseAgeToDigestUpdate(
          pinDigestUpdate,
          config,
          res,
          isValid || unconstrainedValue,
          newestMatchingVersionTimestamp,
        );
        res.updates.push(pinDigestUpdate);
      }
      if (versioningApi.valueToVersion) {
        // TODO #22198
        res.currentVersion = versioningApi.valueToVersion(res.currentVersion!);
        for (const update of res.updates) {
          // TODO #22198
          update.newVersion = versioningApi.valueToVersion(update.newVersion!);
        }
      }
      if (res.registryUrl) {
        config.registryUrls = [res.registryUrl];
      }

      // update digest for all
      await resolveUpdateDigests(config, res, dependency);
    }

    if (res.updates.length) {
      delete res.skipReason;
    }
    // Strip out any non-changed ones
    res.updates = stripNoopUpdates(config, res.updates);

    // If there is a digest update proposed which is in the pending updates for this dependency, ensure that `minimumReleaseAge` is applied.
    // `currentVersionWasResolved` only matters for `pinDigest`, which `digestUpdate` never is - true is a safe constant.
    if (digestUpdate && res.updates.includes(digestUpdate)) {
      await applyMinimumReleaseAgeToDigestUpdate(
        digestUpdate,
        config,
        res,
        true,
        newestMatchingVersionTimestamp,
      );
    }

    const release =
      res.updates.length > 0
        ? (dependency?.releases.find(
            (r) => r.version === res.updates[0].newValue,
          ) ??
          dependency?.releases.find(
            (r) => r.version === res.updates[0].newVersion,
          ))
        : null;

    if (release?.changelogContent) {
      res.changelogContent = release.changelogContent;
      res.changelogUrl = release.changelogUrl;
    }
  } catch (err) /* istanbul ignore next */ {
    if (err instanceof ExternalHostError) {
      return Result.err(err);
    }

    if (err instanceof Error && err.message === CONFIG_VALIDATION) {
      return Result.err(err);
    }

    logger.error(
      {
        currentDigest: config.currentDigest,
        currentValue: config.currentValue,
        datasource: config.datasource,
        packageName: config.packageName,
        digestOneAndOnly: config.digestOneAndOnly,
        followTag: config.followTag,
        lockedVersion: config.lockedVersion,
        packageFile: config.packageFile,
        pinDigests: config.pinDigests,
        rollbackPrs: config.rollbackPrs,
        isVulnerabilityAlert: config.isVulnerabilityAlert,
        updatePinnedDependencies: config.updatePinnedDependencies,
        err,
      },
      'lookupUpdates error',
    );
    res.skipReason = 'internal-error';
  }
  return Result.ok(res);
}
