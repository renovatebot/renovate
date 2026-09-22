import { isNonEmptyString } from '@sindresorhus/is';
import { mergeChildConfig } from '../../../../config/index.ts';
import { logger } from '../../../../logger/index.ts';
import type {
  GetDigestInputConfig,
  ReleaseResult,
} from '../../../../modules/datasource/index.ts';
import { getDigest } from '../../../../modules/datasource/index.ts';
import type { LookupUpdate } from '../../../../modules/manager/types.ts';
import { checkMinimumReleaseAge } from '../../../../util/minimum-release-age.ts';
import type { Timestamp } from '../../../../util/timestamp.ts';
import {
  missingReleaseTimestampWarning,
  resolveUpdateTypeConfig,
} from './filter-checks.ts';
import type { LookupUpdateConfig, UpdateResult } from './types.ts';

/** The only two `updateType`s that `applyMinimumReleaseAgeToDigestUpdate()` can be called with */
export type DigestLikeUpdate = LookupUpdate & {
  updateType: 'digest' | 'pinDigest';
};

/**
 * A helper function to allow a short-circuit for `minimumReleaseAge` functionality if a package may have config that applies it.
 *
 * Allows avoiding unnecessary calls to more expensive checks like merge + `applyPackageRules()` and `getTimestamp()`.
 */
export function couldApplyMinimumReleaseAgeToDigest(
  config: LookupUpdateConfig,
  updateType: DigestLikeUpdate['updateType'],
): boolean {
  // Match filterInternalChecks(): under `none` the user opted out of internal
  // checks entirely, so do no merging, no package rules, no age check and no
  // logging claiming an age check ran.
  if (config.internalChecksFilter === 'none') {
    return false;
  }

  return (
    isNonEmptyString(config.minimumReleaseAge) ||
    isNonEmptyString(config[updateType]?.minimumReleaseAge) ||
    !!config.packageRules?.some((rule) =>
      isNonEmptyString(rule.minimumReleaseAge),
    )
  );
}

/**
 * Ensure `minimumReleaseAge`/`internalChecksFilter` applies to digest/pinDigest updates, as they don't currently get run through `filterInternalChecks()`.
 */
export async function applyMinimumReleaseAgeToDigestUpdate(
  update: DigestLikeUpdate,
  config: LookupUpdateConfig,
  res: UpdateResult,
  currentVersionWasResolved: boolean,
  newestMatchingVersionTimestamp: Timestamp | null | undefined,
): Promise<void> {
  if (!couldApplyMinimumReleaseAgeToDigest(config, update.updateType)) {
    return;
  }

  if (update.updateType === 'pinDigest' && !currentVersionWasResolved) {
    // Not `!res.currentVersion` - that's force-set to lockedVersion further down regardless of timestamp resolution.
    // `pinDigest` doesn't repoint anywhere, unlike `digest` - it just freezes whatever the ref already resolves to.
    // An unversioned tag (e.g. `latest`) has no versioned release to age against, and holding the pin would only
    // prolong the less-pinned (less safe) state, so skip the check entirely rather than treating the missing
    // timestamp as pending.
    logger.once.debug(
      { depName: config.depName, updateType: update.updateType },
      `Skipping minimumReleaseAge check for ${update.updateType} update of ${config.depName}, as its current value does not resolve to a versioned release`,
    );
    return;
  }

  const releaseConfig = await resolveUpdateTypeConfig(
    mergeChildConfig(config, res),
    update.updateType,
  );

  // Not update.releaseTimestamp - that field means "age of the new release" elsewhere (generate.ts, libyear.ts).
  // Not res.currentVersionTimestamp either - that tracks whatever rangeStrategy resolves currentVersion to (e.g.
  // the oldest matching release under `bump`), whereas both `digest` and `pinDigest` reflect whatever the current
  // value's ref actually resolves to *right now*, which is always the newest matching version.
  const ageCheck = checkMinimumReleaseAge(
    releaseConfig,
    newestMatchingVersionTimestamp,
  );

  // Mirror filterInternalChecks()'s logging so a held/passed digest update is diagnosable.
  if (ageCheck.minimumReleaseAgeMs && !ageCheck.hasTimestamp) {
    if (releaseConfig.minimumReleaseAgeBehaviour === 'timestamp-optional') {
      logger.once.warn(missingReleaseTimestampWarning);
    }

    logger.once.debug(
      {
        depName: config.depName,
        updateType: update.updateType,
        minimumReleaseAgeBehaviour: releaseConfig.minimumReleaseAgeBehaviour,
        check: 'minimumReleaseAge',
      },
      `${update.updateType} update of ${config.depName} has no releaseTimestamp to age against`,
    );
  }
  if (ageCheck.isPending) {
    logger.trace(
      {
        depName: config.depName,
        updateType: update.updateType,
        releaseTimestamp: newestMatchingVersionTimestamp,
        check: 'minimumReleaseAge',
      },
      `${update.updateType} update is pending minimumReleaseAge status checks`,
    );

    // internalChecksFilter is read from the unmerged top-level config, like filterInternalChecks().
    if (config.internalChecksFilter === 'strict') {
      update.pendingChecks = true;
    }
  }
}

function getDigestInputConfig(
  config: LookupUpdateConfig,
  res: UpdateResult,
  update: LookupUpdate,
): GetDigestInputConfig {
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
    getDigestConfig.replacementName = update.newName;
  }

  return getDigestConfig;
}

async function resolveUpdateDigest(
  config: LookupUpdateConfig,
  res: UpdateResult,
  dependency: ReleaseResult | null,
  update: LookupUpdate,
): Promise<void> {
  // Don't use current releases if replacement changes name, otherwise we use the wrong new digest.
  // This happens on datasources which return the digest in release info like `github-tags`.
  // We can still use it when only version is changing.
  if (
    update.updateType !== 'replacement' ||
    update.newName === config.packageName
  ) {
    update.newDigest ??= dependency?.releases.find(
      (r) => r.version === update.newValue,
    )?.newDigest;
  }

  update.newDigest ??= await getDigest(
    getDigestInputConfig(config, res, update),
    update.newValue,
  );

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
}

/**
 * Fill in `newDigest` (and, where a release came from another registry,
 * `registryUrl`) for every update.
 */
export async function resolveUpdateDigests(
  config: LookupUpdateConfig,
  res: UpdateResult,
  dependency: ReleaseResult | null,
): Promise<void> {
  for (const update of res.updates) {
    // only update the digest in the package file if it's managed by us
    if (
      (config.pinDigests === true && !config.digestManagedExternally) ||
      config.currentDigest
    ) {
      await resolveUpdateDigest(config, res, dependency, update);
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
