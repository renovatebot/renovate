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
  dockerRepository?: string;
  dockerRegistry?: string;
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
  fromVersion: string,
  toVersion: string
): UpdateType {
  const { versioning, rangeStrategy, currentValue } = config;
  const version = allVersioning.get(versioning);
  if (rangeStrategy === 'bump' && version.matches(toVersion, currentValue)) {
    return 'bump';
  }
  if (version.getMajor(toVersion) > version.getMajor(fromVersion)) {
    return 'major';
  }
  if (version.getMinor(toVersion) > version.getMinor(fromVersion)) {
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

function getBucket(config: LookupUpdateConfig, update: LookupUpdate): string {
  const { separateMajorMinor, separateMultipleMajor } = config;
  const { updateType, newMajor } = update;
  if (updateType === 'lockfileUpdate') {
    return updateType;
  }
  if (
    !separateMajorMinor ||
    config.major.automerge === true ||
    (config.automerge && config.major.automerge !== false)
  ) {
    return 'latest';
  }
  if (separateMultipleMajor && updateType === 'major') {
    return `major-${newMajor}`;
  }
  return updateType;
}

export async function lookupUpdates(
  inconfig: LookupUpdateConfig
): Promise<UpdateResult> {
  let config: LookupUpdateConfig = { ...inconfig };
  const { depName, currentValue, lockedVersion, vulnerabilityAlert } = config;
  logger.trace({ dependency: depName, currentValue }, 'lookupUpdates');
  // Use the datasource's default versioning if none is configured
  const version = allVersioning.get(
    config.versioning || getDefaultVersioning(config.datasource)
  );
  const res: UpdateResult = { updates: [], warnings: [] } as any;

  const isValid = currentValue && version.isValid(currentValue);
  if (!isValid) {
    res.skipReason = SkipReason.InvalidValue;
  }
  // Record if the dep is fixed to a version
  if (lockedVersion) {
    res.fixedVersion = lockedVersion;
  } else if (currentValue && version.isSingleVersion(currentValue)) {
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
    // TODO: improve this
    // istanbul ignore if
    if (dependency.dockerRegistry) {
      res.dockerRegistry = dependency.dockerRegistry;
      res.dockerRepository = dependency.dockerRepository;
    }
    const { latestVersion, releases } = dependency;
    // Filter out any results from datasource that don't comply with our versioning
    let allVersions = releases.filter((release) =>
      version.isVersion(release.version)
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
            version.isGreaterThan(taggedVersion, currentValue))
      );
    }
    // Check that existing constraint can be satisfied
    const allSatisfyingVersions = allVersions.filter((v) =>
      version.matches(v.version, currentValue)
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
    const fromVersion =
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
      fromVersion &&
      rangeStrategy === 'pin' &&
      !version.isSingleVersion(currentValue)
    ) {
      res.updates.push({
        updateType: 'pin',
        isPin: true,
        newValue: version.getNewValue({
          currentValue,
          rangeStrategy,
          fromVersion,
          toVersion: fromVersion,
        }),
        newMajor: version.getMajor(fromVersion),
      });
    }
    let filterStart = fromVersion;
    if (lockedVersion && rangeStrategy === 'update-lockfile') {
      // Look for versions greater than the current locked version that still satisfy the package.json range
      filterStart = lockedVersion;
    }
    // Filter latest, unstable, etc
    let filteredVersions = filterVersions(
      config,
      filterStart,
      dependency.latestVersion,
      allVersions
    ).filter((v) =>
      // Leave only compatible versions
      version.isCompatible(v.version, currentValue)
    );
    if (vulnerabilityAlert) {
      filteredVersions = filteredVersions.slice(0, 1);
    }
    const buckets: Record<string, [LookupUpdate]> = {};
    for (const toVersion of filteredVersions.map((v) => v.version)) {
      const update: LookupUpdate = { fromVersion, toVersion } as any;
      try {
        update.newValue = version.getNewValue({
          currentValue,
          rangeStrategy,
          fromVersion,
          toVersion,
        });
      } catch (err) /* istanbul ignore next */ {
        logger.warn(
          { err, currentValue, rangeStrategy, fromVersion, toVersion },
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
            { depName, currentValue, lockedVersion, toVersion },
            'Skipping bump because newValue is the same'
          );
          continue; // eslint-disable-line no-continue
        }
        update.updateType = 'lockfileUpdate';
        update.fromVersion = lockedVersion;
        update.displayFrom = lockedVersion;
        update.displayTo = toVersion;
        update.isSingleVersion = true;
      }
      update.newMajor = version.getMajor(toVersion);
      update.newMinor = version.getMinor(toVersion);
      update.updateType =
        update.updateType || getType(config, update.fromVersion, toVersion);
      update.isSingleVersion =
        update.isSingleVersion || !!version.isSingleVersion(update.newValue);
      if (!version.isVersion(update.newValue)) {
        update.isRange = true;
      }
      const updateRelease = releases.find((release) =>
        version.equals(release.version, toVersion)
      );
      // TODO: think more about whether to just Object.assign this
      const releaseFields: (keyof Pick<
        Release,
        'releaseTimestamp' | 'downloadUrl' | 'checksumUrl' | 'newDigest'
      >)[] = ['releaseTimestamp', 'newDigest'];
      releaseFields.forEach((field) => {
        if (updateRelease[field] !== undefined) {
          update[field] = updateRelease[field] as never;
        }
      });

      const bucket = getBucket(config, update);
      if (buckets[bucket]) {
        buckets[bucket].push(update);
      } else {
        buckets[bucket] = [update];
      }
    }
    for (const updates of Object.values(buckets)) {
      const sortedUpdates = updates.sort((u1, u2) =>
        version.sortVersions(u1.toVersion, u2.toVersion)
      );
      const update = sortedUpdates.pop();
      if (sortedUpdates.length) {
        update.skippedOverVersions = sortedUpdates.map((u) => u.toVersion);
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
    if (version.valueToVersion) {
      for (const update of res.updates || []) {
        update.newVersion = version.valueToVersion(update.newValue);
        update.fromVersion = version.valueToVersion(update.fromVersion);
        update.toVersion = version.valueToVersion(update.toVersion);
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
  for (const update of res.updates) {
    const { updateType, fromVersion, toVersion } = update;
    if (['bump', 'lockfileUpdate'].includes(updateType)) {
      update[updateType === 'bump' ? 'isBump' : 'isLockfileUpdate'] = true;
      if (version.getMajor(toVersion) > version.getMajor(fromVersion)) {
        update.updateType = 'major';
      } else if (
        config.separateMinorPatch &&
        version.getMinor(toVersion) === version.getMinor(fromVersion)
      ) {
        update.updateType = 'patch';
      } else {
        update.updateType = 'minor';
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
