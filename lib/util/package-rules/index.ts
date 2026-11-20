import {
  isNonEmptyArray,
  isNullOrUndefined,
  isString,
  isTruthy,
} from '@sindresorhus/is';
import _slugify from 'slugify';
import type {
  PackageRule,
  PackageRuleInputConfig,
} from '../../config/types.ts';
import { mergeChildConfig } from '../../config/utils.ts';
import { logger } from '../../logger/index.ts';
import type { StageName } from '../../types/skip-reason.ts';
import { coerceArray } from '../array.ts';
import { compile } from '../template/index.ts';
import matchers from './matchers.ts';

const slugify = _slugify;

const replacementKeys = [
  'replacementName',
  'replacementNameTemplate',
  'replacementVersion',
  'replacementVersionTemplate',
] as const;

function describeRule(
  rule: PackageRule,
  ruleIndex: number,
): Record<string, unknown> {
  return {
    ruleIndex,
    ...Object.fromEntries(
      Object.entries(rule).filter(
        ([key]) =>
          key === 'description' ||
          key.startsWith('match') ||
          key.startsWith('exclude') ||
          key.startsWith('replacement'),
      ),
    ),
  };
}

function hasRegistryUrls(config: PackageRuleInputConfig): boolean {
  return (
    isNonEmptyArray(config.registryUrls) ||
    isNonEmptyArray(config.defaultRegistryUrls)
  );
}

async function matchesRule(
  inputConfig: PackageRuleInputConfig,
  packageRule: PackageRule,
): Promise<boolean> {
  for (const matcher of matchers) {
    const isMatch = await matcher.matches(inputConfig, packageRule);

    // no rules are defined
    if (isNullOrUndefined(isMatch)) {
      continue;
    }

    if (!isTruthy(isMatch)) {
      return false;
    }
  }

  return true;
}

export async function applyPackageRules<T extends PackageRuleInputConfig>(
  inputConfig: T,
  stageName?: StageName,
): Promise<T> {
  let config = { ...inputConfig };
  const packageRules = coerceArray(config.packageRules);
  // The `packageRules` array is invariant while rules are being applied, and
  // can be very large (e.g. vulnerability alerts append rules embedding full
  // advisory texts). Remove it from the working config so mergeChildConfig()
  // does not deep-clone the whole array once per matched rule, then restore
  // it afterwards.
  delete config.packageRules;
  logger.trace(
    { dependency: config.depName, packageRules },
    `Checking against ${packageRules.length} packageRules`,
  );
  const replacementRuleIndexes = new Map<string, number>();
  for (const [ruleIndex, packageRule] of packageRules.entries()) {
    // This rule is considered matched if there was at least one positive match and no negative matches
    if (await matchesRule(config, packageRule)) {
      // Package rule config overrides any existing config
      const toApply = removeMatchers({ ...packageRule });
      if (config.groupSlug && packageRule.groupName && !packageRule.groupSlug) {
        // Need to apply groupSlug otherwise the existing one will take precedence
        toApply.groupSlug = slugify(packageRule.groupName, {
          lower: true,
        });
      }

      // unless a force'd config option wins, record it even if the
      // dependency is already disabled, so a user's rule can be told apart
      // from a manager disabling it by default
      const isDisabledWithoutForce =
        toApply.enabled === false && config.force?.enabled !== true;
      if (
        // if it's got higher precedence, as it's a force'd config option
        // multiple force'd config options are "last defined wins"
        toApply.force?.enabled === false ||
        isDisabledWithoutForce
      ) {
        config.skipReason = 'package-rules';
        if (stageName) {
          config.skipStage = stageName;
        }
      }

      const isEnabled = !!toApply.force?.enabled || !!toApply.enabled;
      if (
        isEnabled &&
        // `unknown-registry` is not about whether the user wants the dependency
        // updated, but about Renovate having nowhere to look it up, so a
        // registry clears it rather than `enabled` - see below
        config.skipReason !== 'unknown-registry'
      ) {
        delete config.skipReason;
        delete config.skipStage;
      }
      if (
        isString(toApply.overrideDatasource) &&
        toApply.overrideDatasource !== config.datasource
      ) {
        logger.debug(
          `Overriding datasource from ${config.datasource} to ${toApply.overrideDatasource} for ${config.depName}`,
        );
        config.datasource = toApply.overrideDatasource;
      }
      if (
        isString(toApply.overrideDepName) &&
        toApply.overrideDepName !== config.depName
      ) {
        logger.debug(
          `Overriding depName from ${config.depName} to ${toApply.overrideDepName}`,
        );
        config.depName = compile(toApply.overrideDepName, config);
      }
      if (
        isString(toApply.overridePackageName) &&
        toApply.overridePackageName !== config.packageName
      ) {
        logger.debug(
          `Overriding packageName from ${config.packageName} to ${toApply.overridePackageName} for ${config.depName}`,
        );
        config.packageName = compile(toApply.overridePackageName, config);
      }
      if (isString(toApply.sourceUrl)) {
        toApply.sourceUrl = compile(toApply.sourceUrl, config);
      }
      for (const key of replacementKeys) {
        if (!isNullOrUndefined(toApply[key])) {
          replacementRuleIndexes.set(key, ruleIndex);
        }
      }
      delete toApply.overrideDatasource;
      delete toApply.overrideDepName;
      delete toApply.overridePackageName;
      config = mergeChildConfig(config, toApply);
    }
  }
  // the last rule to set a field wins, so the replacement is only a mix of
  // rules if the winning rules differ
  if (new Set(replacementRuleIndexes.values()).size > 1) {
    logger.once.warn(
      { depName: config.depName, packageName: config.packageName },
      'The `replacement*` fields come from multiple matching `packageRules`, which may result in an invalid replacement. See the debug logs for the rules which set each field',
    );
    logger.once.debug(
      {
        depName: config.depName,
        packageName: config.packageName,
        replacementRules: Object.fromEntries(
          [...replacementRuleIndexes].map(([field, ruleIndex]) => [
            field,
            describeRule(packageRules[ruleIndex], ruleIndex),
          ]),
        ),
      },
      'Rules which set each `replacement*` field',
    );
  }
  // A manager which could not work out where to look leaves `unknown-registry`
  // behind. Config can still answer that, from a rule applied above or from the
  // repository config the rules were applied to, so the dependency is no longer
  // skipped once it has a registry to be looked up in.
  if (config.skipReason === 'unknown-registry' && hasRegistryUrls(config)) {
    delete config.skipReason;
    delete config.skipStage;
  }

  // Restore the rules. If any applied rule carried nested `packageRules`
  // (e.g. from a resolved preset), preserve the concat-merge semantics that
  // mergeChildConfig() would previously have applied.
  if (config.packageRules) {
    config.packageRules = packageRules.concat(config.packageRules);
  } else if ('packageRules' in inputConfig) {
    config.packageRules = inputConfig.packageRules;
  }
  return config;
}

function removeMatchers<T extends Record<string, unknown>>(
  packageRule: T,
): Record<string, unknown> & {
  force?: Record<string, unknown>;
} {
  for (const key of Object.keys(packageRule)) {
    if (key.startsWith('match') || key.startsWith('exclude')) {
      delete packageRule[key];
    }
  }

  return packageRule;
}
