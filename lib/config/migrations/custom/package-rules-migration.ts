import is from '@sindresorhus/is';
import type { PackageRule } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export const renameMap = {
  matchFiles: 'matchFileNames',
  matchPaths: 'matchFileNames',
  paths: 'matchFileNames',
  languages: 'matchCategories',
  matchLanguages: 'matchCategories',
  baseBranchList: 'matchBaseBranches',
  managers: 'matchManagers',
  datasources: 'matchDatasources',
  depTypeList: 'matchDepTypes',
  packageNames: 'matchPackageNames',
  packagePatterns: 'matchPackagePatterns',
  sourceUrlPrefixes: 'matchSourceUrlPrefixes',
  updateTypes: 'matchUpdateTypes',
};
type RenameMapKey = keyof typeof renameMap;

function renameKeys(packageRule: PackageRule): PackageRule {
  const newPackageRule: PackageRule = {};
  for (const [key, val] of Object.entries(packageRule)) {
    newPackageRule[renameMap[key as RenameMapKey] ?? key] = val;
  }
  return newPackageRule;
}

function mergeMatchers(packageRule: PackageRule): PackageRule {
  const newPackageRule: PackageRule = { ...packageRule };
  for (const [key, val] of Object.entries(packageRule)) {
    const patterns = is.string(val) ? [val] : val;

    // depName
    if (key === 'matchDepPrefixes') {
      if (is.array(patterns, is.string)) {
        newPackageRule.matchDepNames ??= [];
        newPackageRule.matchDepNames.push(...patterns.map((v) => `${v}{/,}**`));
      }
      delete newPackageRule.matchDepPrefixes;
    }
    if (key === 'matchDepPatterns') {
      if (is.array(patterns, is.string)) {
        newPackageRule.matchDepNames ??= [];
        newPackageRule.matchDepNames.push(...patterns.map((v) => `/${v}/`));
      }
      delete newPackageRule.matchDepPatterns;
    }
    if (key === 'excludeDepNames') {
      if (is.array(patterns, is.string)) {
        newPackageRule.matchDepNames ??= [];
        newPackageRule.matchDepNames.push(...patterns.map((v) => `!${v}`));
      }
      delete newPackageRule.excludeDepNames;
    }
    if (key === 'excludeDepPrefixes') {
      if (is.array(patterns, is.string)) {
        newPackageRule.matchDepNames ??= [];
        newPackageRule.matchDepNames.push(
          ...patterns.map((v) => `!${v}{/,}**`),
        );
      }
      delete newPackageRule.excludeDepPrefixes;
    }
    if (key === 'excludeDepPatterns') {
      if (is.array(patterns, is.string)) {
        newPackageRule.matchDepNames ??= [];
        newPackageRule.matchDepNames.push(...patterns.map((v) => `!/${v}/`));
      }
      delete newPackageRule.excludeDepPatterns;
    }
    // packageName
    if (key === 'matchPackagePrefixes') {
      if (is.array(patterns, is.string)) {
        newPackageRule.matchPackageNames ??= [];
        newPackageRule.matchPackageNames.push(
          ...patterns.map((v) => `${v}{/,}**`),
        );
      }
      delete newPackageRule.matchPackagePrefixes;
    }
    if (key === 'matchPackagePatterns') {
      if (is.array(patterns, is.string)) {
        newPackageRule.matchPackageNames ??= [];
        newPackageRule.matchPackageNames.push(
          ...patterns.map((v) => {
            if (v === '*') {
              return '*';
            }
            return `/${v}/`;
          }),
        );
      }
      delete newPackageRule.matchPackagePatterns;
    }
    if (key === 'excludePackageNames') {
      if (is.array(patterns, is.string)) {
        newPackageRule.matchPackageNames ??= [];
        newPackageRule.matchPackageNames.push(...patterns.map((v) => `!${v}`));
      }
      delete newPackageRule.excludePackageNames;
    }
    if (key === 'excludePackagePrefixes') {
      if (is.array(patterns, is.string)) {
        newPackageRule.matchPackageNames ??= [];
        newPackageRule.matchPackageNames.push(
          ...patterns.map((v) => `!${v}{/,}**`),
        );
      }
      delete newPackageRule.excludePackagePrefixes;
    }
    if (key === 'excludePackagePatterns') {
      if (is.array(patterns, is.string)) {
        newPackageRule.matchPackageNames ??= [];
        newPackageRule.matchPackageNames.push(
          ...patterns.map((v) => `!/${v}/`),
        );
      }
      delete newPackageRule.excludePackagePatterns;
    }
    // sourceUrl
    if (key === 'matchSourceUrlPrefixes') {
      if (is.array(patterns, is.string)) {
        newPackageRule.matchSourceUrls ??= [];
        newPackageRule.matchSourceUrls.push(
          ...patterns.map((v) => `${v}{/,}**`),
        );
      }
      delete newPackageRule.matchSourceUrlPrefixes;
    }
    // repository
    if (key === 'excludeRepositories') {
      if (is.array(patterns, is.string)) {
        newPackageRule.matchRepositories ??= [];
        newPackageRule.matchRepositories.push(...patterns.map((v) => `!${v}`));
      }
      delete newPackageRule.excludeRepositories;
    }
  }
  return newPackageRule;
}

export class PackageRulesMigration extends AbstractMigration {
  override readonly propertyName = 'packageRules';

  override run(value: unknown): void {
    let packageRules = this.get('packageRules')!;
    if (is.nonEmptyArray(packageRules)) {
      packageRules = packageRules.map(renameKeys);
      packageRules = packageRules.map(mergeMatchers);
      this.rewrite(packageRules);
    }
  }
}
