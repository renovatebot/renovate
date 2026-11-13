import semver from 'semver';
import { logger } from '~test/util.ts';
import { coerceArray } from '../../../util/array.ts';
import { applyPackageRules } from '../../../util/package-rules/index.ts';
import type { PackageRule } from '../../types.ts';
import { presets } from './replacements.preset.ts';

type ReplacementRule = PackageRule & {
  replacementNameTemplate?: string;
  replacementVersionTemplate?: string;
};

interface PresetRule {
  presetName: string;
  rule: ReplacementRule;
}

const globChars = /[*?{}[\]]/;

function isLiteralName(name: string): boolean {
  return (
    !name.startsWith('/') && !name.startsWith('!') && !globChars.test(name)
  );
}

function hasName(rule: ReplacementRule): boolean {
  return !!rule.replacementName || !!rule.replacementNameTemplate;
}

function hasVersion(rule: ReplacementRule): boolean {
  return !!rule.replacementVersion || !!rule.replacementVersionTemplate;
}

/**
 * Groups the rules which configure a replacement by each datasource and literal package name they match,
 * which is the key that `packageRules` would be merged on for a dependency.
 */
function groupByPackage(rules: PresetRule[]): Map<string, PresetRule[]> {
  const groups = new Map<string, PresetRule[]>();
  for (const presetRule of rules) {
    if (!hasName(presetRule.rule) && !hasVersion(presetRule.rule)) {
      continue;
    }
    for (const datasource of coerceArray(presetRule.rule.matchDatasources)) {
      for (const name of coerceArray(presetRule.rule.matchPackageNames)) {
        if (isLiteralName(name)) {
          const key = `${datasource}:${name}`;
          groups.set(key, [...coerceArray(groups.get(key)), presetRule]);
        }
      }
    }
  }
  return groups;
}

function mayOverlap(a: ReplacementRule, b: ReplacementRule): boolean {
  const rangeA = semver.validRange(a.matchCurrentVersion);
  const rangeB = semver.validRange(b.matchCurrentVersion);
  if (!a.matchCurrentVersion || !b.matchCurrentVersion || !rangeA || !rangeB) {
    return true;
  }
  return semver.intersects(rangeA, rangeB);
}

// presets which deliberately replace a package with one that is itself replaced
const chainedPresets = new Set([
  'joi-to-scoped',
  'joi-to-unscoped',
  'tsconfig-bases-node',
]);

describe('config/presets/internal/replacements.preset', () => {
  const presetNames = Object.keys(presets).filter((name) => name !== 'all');
  const rules: PresetRule[] = presetNames.flatMap((presetName) =>
    coerceArray(presets[presetName].packageRules as ReplacementRule[]).map(
      (rule) => ({
        presetName,
        rule,
      }),
    ),
  );
  const groups = [...groupByPackage(rules)];

  it('replacements:all extends every other replacements preset', () => {
    const expected = Object.keys(presets)
      .filter((name) => name !== 'all')
      .sort()
      .map((name) => `replacements:${name}`);

    expect(presets.all.extends).toEqual(expected);
    expect(presets.all.extends).toContain('replacements:material-ui-to-mui');
    expect(presets.all.extends).toContain(
      'replacements:clang-format-to-maintenance-fork',
    );
  });

  it.each(groups)(
    '%s is not given a name by one rule and a version by another',
    (_key, group) => {
      const nameOnly = group.filter(
        ({ rule }) => hasName(rule) && !hasVersion(rule),
      );
      const versionOnly = group.filter(
        ({ rule }) => hasVersion(rule) && !hasName(rule),
      );

      expect(nameOnly.length === 0 || versionOnly.length === 0).toBeTrue();
    },
  );

  it.each(groups)(
    '%s is not replaced by multiple rules which may match the same version',
    (_key, group) => {
      const overlapping = group.flatMap((a, i) =>
        group
          .slice(i + 1)
          .filter((b) => mayOverlap(a.rule, b.rule))
          .map((b) => [a.presetName, b.presetName]),
      );

      expect(overlapping).toBeEmptyArray();
    },
  );

  const unconditionalCases = rules.flatMap(({ presetName, rule }) =>
    !rule.matchCurrentVersion && !rule.matchCurrentValue && rule.replacementName
      ? coerceArray(rule.matchPackageNames)
          .filter(isLiteralName)
          .map((packageName) => ({
            presetName,
            packageName,
            datasource: coerceArray(rule.matchDatasources)[0],
            replacementName: rule.replacementName,
            replacementVersion: rule.replacementVersion,
          }))
      : [],
  );

  it.each(unconditionalCases)(
    'replacements:$presetName replaces $packageName with only its own fields when all rules are applied',
    async ({
      packageName,
      datasource,
      replacementName,
      replacementVersion,
    }) => {
      const res = await applyPackageRules({
        depName: packageName,
        packageName,
        datasource,
        packageRules: rules.map(({ rule }) => rule),
      });

      const { replacementName: name, replacementVersion: version } =
        res as ReplacementRule;
      expect({ replacementName: name, replacementVersion: version }).toEqual({
        replacementName,
        replacementVersion,
      });
      expect(logger.logger.once.warn).not.toHaveBeenCalled();
    },
  );

  const namedCases = rules
    .filter(({ rule }) => !!rule.replacementName)
    .map(({ presetName, rule }) => ({
      presetName,
      rule,
      replacementName: rule.replacementName!,
    }));

  it.each(namedCases)(
    'replacements:$presetName does not replace a package with itself ($replacementName)',
    ({ rule, replacementName }) => {
      expect(rule.matchPackageNames).not.toContain(replacementName);
    },
  );

  it.each(
    namedCases.filter(({ presetName }) => !chainedPresets.has(presetName)),
  )(
    'replacements:$presetName only replaces with a package that is itself replaced if intended ($replacementName)',
    ({ rule, replacementName }) => {
      const replacedAgain = rules.filter(
        (other) =>
          other.rule !== rule &&
          hasName(other.rule) &&
          other.rule.matchPackageNames?.includes(replacementName) &&
          coerceArray(other.rule.matchDatasources).some((datasource) =>
            coerceArray(rule.matchDatasources).includes(datasource),
          ),
      );

      expect(replacedAgain).toBeEmptyArray();
    },
  );
});
