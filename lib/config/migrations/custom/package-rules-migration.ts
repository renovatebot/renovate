import { isArray, isNonEmptyArray, isString } from '@sindresorhus/is';
import type { PackageRule } from '../../types.ts';
import { AbstractMigration } from '../base/abstract-migration.ts';

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

const positiveMatchAllMatchers = new Set(['*', '**']);
const legacyMatchAllPatterns = new Set(['*', '**', '!*', '!**']);
const negativeMatchAllMatchers = new Set(['!**']);
const regexOrGlobPackageRuleMatchers = [
  'matchBaseBranches',
  'matchCategories',
  'matchDatasources',
  'matchDepNames',
  'matchDepTypes',
  'matchFileNames',
  'matchManagers',
  'matchPackageNames',
  'matchRegistryUrls',
  'matchRepositories',
  'matchSourceUrls',
  'matchUpdateTypes',
] satisfies (keyof PackageRule)[];

function isPositiveMatchAll(matcher: string): boolean {
  return positiveMatchAllMatchers.has(matcher);
}

function isNegativeMatchAll(matcher: string): boolean {
  return negativeMatchAllMatchers.has(matcher);
}

function migratePattern(pattern: string): string {
  if (legacyMatchAllPatterns.has(pattern)) {
    return '*';
  }
  return `/${pattern}/`;
}

function migrateExcludePattern(pattern: string): string {
  if (legacyMatchAllPatterns.has(pattern)) {
    return '!**';
  }
  return `!/${pattern}/`;
}

function migrateExcludePatterns(patterns: string[]): string[] {
  const matchers: string[] = [];
  for (const pattern of patterns) {
    matchers.push(migrateExcludePattern(pattern));
  }
  return matchers;
}

function normalizeMatchers(matchers: string[]): string[] {
  const negativeMatchAll = matchers.find(isNegativeMatchAll);
  if (negativeMatchAll) {
    return [negativeMatchAll];
  }

  const positiveMatchAll = matchers.find(isPositiveMatchAll);
  if (!positiveMatchAll) {
    return matchers;
  }

  const negativeMatchers = matchers.filter((matcher) =>
    matcher.startsWith('!'),
  );
  if (negativeMatchers.length) {
    return negativeMatchers;
  }

  return [positiveMatchAll];
}

function normalizeRegexOrGlobMatchers(packageRule: PackageRule): PackageRule {
  const newPackageRule = { ...packageRule };

  for (const key of regexOrGlobPackageRuleMatchers) {
    const matchers = newPackageRule[key];
    if (isArray(matchers, isString)) {
      Object.assign(newPackageRule, { [key]: normalizeMatchers(matchers) });
    }
  }

  return newPackageRule;
}

function renameKeys(packageRule: PackageRule): PackageRule {
  const newPackageRule: PackageRule = {};
  for (const [key, val] of Object.entries(packageRule)) {
    // @ts-expect-error -- TODO: fix me
    newPackageRule[renameMap[key as RenameMapKey] ?? key] = val;
  }
  return newPackageRule;
}

function mergeMatchers(packageRule: PackageRule): PackageRule {
  const newPackageRule: PackageRule = { ...packageRule };
  for (const [key, val] of Object.entries(packageRule)) {
    const patterns = isString(val) ? [val] : val;

    // depName
    if (key === 'matchDepPrefixes') {
      // v8 ignore else -- TODO: add test #40625
      if (isArray(patterns, isString)) {
        newPackageRule.matchDepNames ??= [];
        newPackageRule.matchDepNames.push(...patterns.map((v) => `${v}{/,}**`));
      }
      // @ts-expect-error -- TODO: fix me
      delete newPackageRule.matchDepPrefixes;
    }
    if (key === 'matchDepPatterns') {
      // v8 ignore else -- TODO: add test #40625
      if (isArray(patterns, isString)) {
        newPackageRule.matchDepNames ??= [];
        newPackageRule.matchDepNames.push(...patterns.map(migratePattern));
      }
      // @ts-expect-error -- TODO: fix me
      delete newPackageRule.matchDepPatterns;
    }
    if (key === 'excludeDepNames') {
      // v8 ignore else -- TODO: add test #40625
      if (isArray(patterns, isString)) {
        newPackageRule.matchDepNames ??= [];
        newPackageRule.matchDepNames.push(...patterns.map((v) => `!${v}`));
      }
      // @ts-expect-error -- TODO: fix me
      delete newPackageRule.excludeDepNames;
    }
    if (key === 'excludeDepPrefixes') {
      // v8 ignore else -- TODO: add test #40625
      if (isArray(patterns, isString)) {
        newPackageRule.matchDepNames ??= [];
        newPackageRule.matchDepNames.push(
          ...patterns.map((v) => `!${v}{/,}**`),
        );
      }
      // @ts-expect-error -- TODO: fix me
      delete newPackageRule.excludeDepPrefixes;
    }
    if (key === 'excludeDepPatterns') {
      // v8 ignore else -- TODO: add test #40625
      if (isArray(patterns, isString)) {
        const matchers = migrateExcludePatterns(patterns);
        if (matchers.length) {
          newPackageRule.matchDepNames ??= [];
          newPackageRule.matchDepNames.push(...matchers);
        }
      }
      // @ts-expect-error -- TODO: fix me
      delete newPackageRule.excludeDepPatterns;
    }
    // packageName
    if (key === 'matchPackagePrefixes') {
      // v8 ignore else -- TODO: add test #40625
      if (isArray(patterns, isString)) {
        newPackageRule.matchPackageNames ??= [];
        newPackageRule.matchPackageNames.push(
          ...patterns.map((v) => `${v}{/,}**`),
        );
      }
      // @ts-expect-error -- TODO: fix me
      delete newPackageRule.matchPackagePrefixes;
    }
    if (key === 'matchPackagePatterns') {
      // v8 ignore else -- TODO: add test #40625
      if (isArray(patterns, isString)) {
        newPackageRule.matchPackageNames ??= [];
        newPackageRule.matchPackageNames.push(...patterns.map(migratePattern));
      }
      // @ts-expect-error -- TODO: fix me
      delete newPackageRule.matchPackagePatterns;
    }
    if (key === 'excludePackageNames') {
      // v8 ignore else -- TODO: add test #40625
      if (isArray(patterns, isString)) {
        newPackageRule.matchPackageNames ??= [];
        newPackageRule.matchPackageNames.push(...patterns.map((v) => `!${v}`));
      }
      // @ts-expect-error -- TODO: fix me
      delete newPackageRule.excludePackageNames;
    }
    if (key === 'excludePackagePrefixes') {
      // v8 ignore else -- TODO: add test #40625
      if (isArray(patterns, isString)) {
        newPackageRule.matchPackageNames ??= [];
        newPackageRule.matchPackageNames.push(
          ...patterns.map((v) => `!${v}{/,}**`),
        );
      }
      // @ts-expect-error -- TODO: fix me
      delete newPackageRule.excludePackagePrefixes;
    }
    if (key === 'excludePackagePatterns') {
      // v8 ignore else -- TODO: add test #40625
      if (isArray(patterns, isString)) {
        const matchers = migrateExcludePatterns(patterns);
        if (matchers.length) {
          newPackageRule.matchPackageNames ??= [];
          newPackageRule.matchPackageNames.push(...matchers);
        }
      }
      // @ts-expect-error -- TODO: fix me
      delete newPackageRule.excludePackagePatterns;
    }
    // sourceUrl
    if (key === 'matchSourceUrlPrefixes') {
      // v8 ignore else -- TODO: add test #40625
      if (isArray(patterns, isString)) {
        newPackageRule.matchSourceUrls ??= [];
        newPackageRule.matchSourceUrls.push(
          ...patterns.map((v) => `${v}{/,}**`),
        );
      }
      // @ts-expect-error -- TODO: fix me
      delete newPackageRule.matchSourceUrlPrefixes;
    }
    // repository
    if (key === 'excludeRepositories') {
      // v8 ignore else -- TODO: add test #40625
      if (isArray(patterns, isString)) {
        newPackageRule.matchRepositories ??= [];
        newPackageRule.matchRepositories.push(...patterns.map((v) => `!${v}`));
      }
      // @ts-expect-error -- TODO: fix me
      delete newPackageRule.excludeRepositories;
    }
  }

  return normalizeRegexOrGlobMatchers(newPackageRule);
}

export class PackageRulesMigration extends AbstractMigration {
  override readonly propertyName = 'packageRules';

  override run(value: unknown): void {
    let packageRules = this.get('packageRules')!;
    // v8 ignore else -- TODO: add test #40625
    if (isNonEmptyArray(packageRules)) {
      packageRules = packageRules.map(renameKeys);
      packageRules = packageRules.map(mergeMatchers);
      this.rewrite(packageRules);
    }
  }
}
