import is from '@sindresorhus/is';
import slugify from 'slugify';
import { mergeChildConfig } from '../../config';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
import type { StageName } from '../../types/skip-reason';
import { compile } from '../template';
import matchers from './matchers';

async function matchesRule(
  inputConfig: PackageRuleInputConfig,
  packageRule: PackageRule,
): Promise<boolean> {
  for (const matcher of matchers) {
    const isMatch = await matcher.matches(inputConfig, packageRule);

    // no rules are defined
    if (is.nullOrUndefined(isMatch)) {
      continue;
    }

    if (!is.truthy(isMatch)) {
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
  const packageRules = config.packageRules ?? [];
  logger.trace(
    { dependency: config.depName, packageRules },
    `Checking against ${packageRules.length} packageRules`,
  );
  for (const packageRule of packageRules) {
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
      if (toApply.enabled === false && config.enabled !== false) {
        config.skipReason = 'package-rules';
        if (stageName) {
          config.skipStage = stageName;
        }
      }
      if (toApply.enabled === true && config.enabled === false) {
        delete config.skipReason;
        delete config.skipStage;
      }
      if (
        is.string(toApply.overrideDatasource) &&
        toApply.overrideDatasource !== config.datasource
      ) {
        logger.debug(
          `Overriding datasource from ${config.datasource} to ${toApply.overrideDatasource} for ${config.depName}`,
        );
        config.datasource = toApply.overrideDatasource;
      }
      if (
        is.string(toApply.overrideDepName) &&
        toApply.overrideDepName !== config.depName
      ) {
        logger.debug(
          `Overriding depName from ${config.depName} to ${toApply.overrideDepName}`,
        );
        config.depName = compile(toApply.overrideDepName, config);
      }
      if (
        is.string(toApply.overridePackageName) &&
        toApply.overridePackageName !== config.packageName
      ) {
        logger.debug(
          `Overriding packageName from ${config.packageName} to ${toApply.overridePackageName} for ${config.depName}`,
        );
        config.packageName = compile(toApply.overridePackageName, config);
      }
      delete toApply.overrideDatasource;
      delete toApply.overrideDepName;
      delete toApply.overridePackageName;
      config = mergeChildConfig(config, toApply);
    }
  }
  return config;
}

function removeMatchers(
  packageRule: PackageRule & PackageRuleInputConfig,
): Record<string, unknown> {
  for (const key of Object.keys(packageRule)) {
    if (key.startsWith('match') || key.startsWith('exclude')) {
      delete packageRule[key];
    }
  }

  return packageRule;
}
