import is from '@sindresorhus/is';
import { mergeChildConfig } from '../../../../config';
import type { ValidationMessage } from '../../../../config/types';
import { CONFIG_VALIDATION } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import type {
  GetDigestInputConfig,
  Release,
  ReleaseResult,
} from '../../../../modules/datasource';
import {
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
import { id as dockerVersioningId } from '../../../../modules/versioning/docker';
import { ExternalHostError } from '../../../../types/errors/external-host-error';
import { assignKeys } from '../../../../util/assign-keys';
import { getElapsedDays } from '../../../../util/date';
import { applyPackageRules } from '../../../../util/package-rules';
import { regEx } from '../../../../util/regex';
import { Result } from '../../../../util/result';
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

function getTimestamp(
  versions: Release[],
  version: string,
  versioningApi: allVersioning.VersioningApi,
): string | null | undefined {
  return versions.find(
    (v) =>
      versioningApi.isValid(v.version) &&
      versioningApi.equals(v.version, version),
  )?.releaseTimestamp;
}

export async function lookupUpdates(
  inconfig: LookupUpdateConfig,
): Promise<Result<UpdateResult, Error>> {
  let config: LookupUpdateConfig = { ...inconfig };
  config.versioning ??= getDefaultVersioning(config.datasource);

  const versioningApi = allVersioning.get(config.versioning);
  const unconstrainedValue =
    !!config.lockedVersion && is.undefined(config.currentValue);

  let dependency: ReleaseResult | null = null;
  const res: UpdateResult = {
    versioning: config.versioning,
    updates: [],
    warnings: [],
  };

  try {
    logger.trace(
      {
        dependency: config.packageName,
        currentValue: config.currentValue,
      },
      'lookupUpdates',
    );
    if (config.currentValue && !is.string(config.currentValue)) {
      // If currentValue is not a string, then it's invalid
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
    if (
      is.string(config.currentValue) &&
      is.string(config.versionCompatibility)
    ) {
      const versionCompatbilityRegEx = regEx(config.versionCompatibility);
      const regexMatch = versionCompatbilityRegEx.exec(config.currentValue);
      if (regexMatch?.groups) {
        logger.debug(
          {
            versionCompatibility: config.versionCompatibility,
            currentValue: config.currentValue,
            packageName: config.packageName,
            groups: regexMatch.groups,
          },
          'version compatibility regex match',
        );
        config.currentCompatibility = regexMatch.groups.compatibility;
        compareValue = regexMatch.groups.version;
      } else {
        logger.debug(
          {
            versionCompatibility: config.versionCompatibility,
            currentValue: config.currentValue,
            packageName: config.packageName,
          },
          'version compatibility regex mismatch',
        );
      }
    }
    const isValid =
      is.string(compareValue) && versioningApi.isValid(compareValue);

    if (unconstrainedValue || isValid) {
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
        .transform((res) => applyDatasourceFilters(res, config))
        .unwrap();

      if (lookupError instanceof Error) {
        throw lookupError;
      }

      if (lookupError) {
        // If dependency lookup fails then warn and return
        const warning: ValidationMessage = {
          topic: config.packageName,
          message: `Failed to look up ${config.datasource} package ${config.packageName}`,
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
      ]);

      const latestVersion = dependency.tags?.latest;
      // Filter out any results from datasource that don't comply with our versioning
      let allVersions = dependency.releases.filter((release) =>
        versioningApi.isVersion(release.version),
      );
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
      // Check that existing constraint can be satisfied
      const allSatisfyingVersions = allVersions.filter(
        (v) =>
          // TODO #22198
          unconstrainedValue || versioningApi.matches(v.version, compareValue!),
      );
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
      let rangeStrategy = getRangeStrategy(config);

      // istanbul ignore next
      if (
        config.isVulnerabilityAlert &&
        rangeStrategy === 'update-lockfile' &&
        !config.lockedVersion
      ) {
        rangeStrategy = 'bump';
      }
      // unconstrained deps with lockedVersion
      if (
        config.isVulnerabilityAlert &&
        !config.currentValue &&
        config.lockedVersion
      ) {
        rangeStrategy = 'update-lockfile';
      }
      const nonDeprecatedVersions = dependency.releases
        .filter((release) => !release.isDeprecated)
        .map((release) => release.version);
      let currentVersion: string;
      if (rangeStrategy === 'update-lockfile') {
        currentVersion = config.lockedVersion!;
      }
      // TODO #22198
      currentVersion ??=
        getCurrentVersion(
          compareValue!,
          config.lockedVersion!,
          versioningApi,
          rangeStrategy!,
          latestVersion!,
          nonDeprecatedVersions,
        ) ??
        getCurrentVersion(
          compareValue!,
          config.lockedVersion!,
          versioningApi,
          rangeStrategy!,
          latestVersion!,
          allVersions.map((v) => v.version),
        )!;

      if (!currentVersion) {
        if (!config.lockedVersion) {
          logger.debug(
            `No currentVersion or lockedVersion found for ${config.packageName}`,
          );
          res.skipReason = 'invalid-value';
        }
        return Result.ok(res);
      }

      res.currentVersion = currentVersion!;
      const currentVersionTimestamp = getTimestamp(
        allVersions,
        currentVersion,
        versioningApi,
      );

      if (is.nonEmptyString(currentVersionTimestamp)) {
        res.currentVersionTimestamp = currentVersionTimestamp;
        res.currentVersionAgeInDays = getElapsedDays(currentVersionTimestamp);

        if (
          config.packageRules?.some((rule) =>
            is.nonEmptyString(rule.matchCurrentAge),
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
        compareValue &&
        currentVersion &&
        rangeStrategy === 'pin' &&
        !versioningApi.isSingleVersion(compareValue)
      ) {
        res.updates.push({
          updateType: 'pin',
          isPin: true,
          // TODO: newValue can be null! (#22198)
          newValue: versioningApi.getNewValue({
            currentValue: compareValue,
            rangeStrategy,
            currentVersion,
            newVersion: currentVersion,
          })!,
          newVersion: currentVersion,
          newMajor: versioningApi.getMajor(currentVersion)!,
        });
      }
      if (rangeStrategy === 'pin') {
        // Fall back to replace once pinning logic is done
        rangeStrategy = 'replace';
      }
      // istanbul ignore if
      if (!versioningApi.isVersion(currentVersion!)) {
        res.skipReason = 'invalid-version';
        return Result.ok(res);
      }
      // Filter latest, unstable, etc
      // TODO #22198
      let filteredReleases = filterVersions(
        config,
        currentVersion!,
        latestVersion!,
        config.rangeStrategy === 'in-range-only'
          ? allSatisfyingVersions
          : allVersions,
        versioningApi,
      ).filter(
        (v) =>
          // Leave only compatible versions
          unconstrainedValue ||
          versioningApi.isCompatible(v.version, compareValue),
      );
      let shrinkedViaVulnerability = false;
      if (config.isVulnerabilityAlert) {
        if (config.vulnerabilityFixVersion) {
          res.vulnerabilityFixVersion = config.vulnerabilityFixVersion;
          res.vulnerabilityFixStrategy = config.vulnerabilityFixStrategy;
          if (versioningApi.isValid(config.vulnerabilityFixVersion)) {
            let fixedFilteredReleases;
            if (versioningApi.isVersion(config.vulnerabilityFixVersion)) {
              // Retain only releases greater than or equal to the fix version
              fixedFilteredReleases = filteredReleases.filter(
                (release) =>
                  !versioningApi.isGreaterThan(
                    config.vulnerabilityFixVersion!,
                    release.version,
                  ),
              );
            } else {
              // Retain only releases which max the fix constraint
              fixedFilteredReleases = filteredReleases.filter((release) =>
                versioningApi.matches(
                  release.version,
                  config.vulnerabilityFixVersion!,
                ),
              );
            }
            // Warn if this filtering results caused zero releases
            if (fixedFilteredReleases.length === 0 && filteredReleases.length) {
              logger.warn(
                {
                  releases: filteredReleases,
                  vulnerabilityFixVersion: config.vulnerabilityFixVersion,
                  packageName: config.packageName,
                },
                'No releases satisfy vulnerabilityFixVersion',
              );
            }
            // Use the additionally filtered releases
            filteredReleases = fixedFilteredReleases;
          } else {
            logger.warn(
              {
                vulnerabilityFixVersion: config.vulnerabilityFixVersion,
                packageName: config.packageName,
              },
              'vulnerabilityFixVersion is not valid',
            );
          }
        }
        if (config.vulnerabilityFixStrategy === 'highest') {
          // Don't shrink the list of releases - let Renovate use its normal logic
          logger.once.debug(
            `Using vulnerabilityFixStrategy=highest for ${config.packageName}`,
          );
        } else {
          // Shrink the list of releases to the lowest fixed version
          logger.once.debug(
            `Using vulnerabilityFixStrategy=lowest for ${config.packageName}`,
          );
          filteredReleases = filteredReleases.slice(0, 1);
          shrinkedViaVulnerability = true;
        }
      }
      const buckets: Record<string, [Release]> = {};
      for (const release of filteredReleases) {
        const bucket = getBucket(
          config,
          // TODO #22198
          currentVersion!,
          release.version,
          versioningApi,
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
          config.lockedVersion ?? currentVersion!,
          bucket,
          release,
        );

        // #29034
        if (
          config.manager === 'gomod' &&
          compareValue?.startsWith('v0.0.0-') &&
          update.newValue?.startsWith('v0.0.0-') &&
          config.currentDigest !== update.newDigest
        ) {
          update.updateType = 'digest';
        }

        if (pendingChecks) {
          update.pendingChecks = pendingChecks;
        }

        // TODO #22198
        if (pendingReleases!.length) {
          update.pendingVersions = pendingReleases!.map((r) => r.version);
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
          is.string(update.newValue) &&
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
    } else if (dependency?.replacementName || dependency?.replacementVersion) {
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
    if (
      is.string(config.currentValue) &&
      is.string(compareValue) &&
      is.string(config.versionCompatibility)
    ) {
      for (const update of res.updates) {
        logger.debug({ update });
        if (is.string(config.currentValue) && is.string(update.newValue)) {
          update.newValue = config.currentValue.replace(
            compareValue,
            update.newValue,
          );
        }
      }
    }

    // Add digests if necessary
    if (supportsDigests(config.datasource)) {
      if (config.currentDigest) {
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
            isPinDigest: true,
            updateType: 'pinDigest',
            newValue: config.currentValue,
          });
        }
      }
      if (versioningApi.valueToVersion) {
        // TODO #22198
        res.currentVersion = versioningApi.valueToVersion(res.currentVersion!);
        for (const update of res.updates || /* istanbul ignore next*/ []) {
          // TODO #22198
          update.newVersion = versioningApi.valueToVersion(update.newVersion!);
        }
      }
      if (res.registryUrl) {
        config.registryUrls = [res.registryUrl];
      }

      // update digest for all
      for (const update of res.updates) {
        if (config.pinDigests === true || config.currentDigest) {
          const getDigestConfig: GetDigestInputConfig = {
            ...config,
            registryUrl: update.registryUrl ?? res.registryUrl,
            lookupName: res.lookupName,
          };

          // #20304 only pass it for replacement updates, otherwise we get wrong or invalid digest
          if (update.updateType !== 'replacement') {
            delete getDigestConfig.replacementName;
          }

          // #20304 don't use lookupName and currentDigest when we replace image name
          if (
            update.updateType === 'replacement' &&
            update.newName !== config.packageName
          ) {
            delete getDigestConfig.lookupName;
            delete getDigestConfig.currentDigest;
          }

          // TODO #22198
          update.newDigest ??=
            dependency?.releases.find((r) => r.version === update.newValue)
              ?.newDigest ??
            (await getDigest(getDigestConfig, update.newValue))!;

          // If the digest could not be determined, report this as otherwise the
          // update will be omitted later on without notice.
          if (update.newDigest === null) {
            logger.debug(
              {
                packageName: config.packageName,
                currentValue: config.currentValue,
                datasource: config.datasource,
                newValue: update.newValue,
                bucket: update.bucket,
              },
              'Could not determine new digest for update.',
            );

            // Only report a warning if there is a current digest.
            // Context: https://github.com/renovatebot/renovate/pull/20175#discussion_r1102615059.
            if (config.currentDigest) {
              res.warnings.push({
                message: `Could not determine new digest for update (${config.datasource} package ${config.packageName})`,
                topic: config.packageName,
              });
            }
          }
        } else {
          delete update.newDigest;
        }
        if (update.newVersion) {
          const registryUrl = dependency?.releases?.find(
            (release) => release.version === update.newVersion,
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
      .filter(
        (update) => update.newValue !== null || config.currentValue === null,
      )
      .filter((update) => update.newDigest !== null)
      .filter(
        (update) =>
          (is.string(update.newName) &&
            update.newName !== config.packageName) ||
          update.isReplacement === true ||
          update.newValue !== config.currentValue ||
          update.isLockfileUpdate === true ||
          // TODO #22198
          (update.newDigest &&
            !update.newDigest.startsWith(config.currentDigest!)),
      );
    // If range strategy specified in config is 'in-range-only', also strip out updates where currentValue !== newValue
    if (config.rangeStrategy === 'in-range-only') {
      res.updates = res.updates.filter(
        (update) => update.newValue === config.currentValue,
      );
    }
    // Handle a weird edge case involving followTag and fallbacks
    if (config.rollbackPrs && config.followTag) {
      res.updates = res.updates.filter(
        (update) =>
          res.updates.length === 1 ||
          /* istanbul ignore next */ update.updateType !== 'rollback',
      );
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
        unconstrainedValue,
        err,
      },
      'lookupUpdates error',
    );
    res.skipReason = 'internal-error';
  }
  return Result.ok(res);
}
