import { isNonEmptyArray, isNonEmptyString } from '@sindresorhus/is';
import semver from 'semver';
import upath from 'upath';
import { logger } from '../../../../logger/index.ts';
import { coerceArray } from '../../../../util/array.ts';
import { readLocalFile } from '../../../../util/fs/index.ts';
import { regEx } from '../../../../util/regex.ts';
import { matchRegexOrGlobList } from '../../../../util/string-match.ts';
import { NpmDatasource } from '../../../datasource/npm/index.ts';
import { intersectsWith, isSubsetOf } from '../../../versioning/common.ts';
import { api as npmVersioning } from '../../../versioning/npm/index.ts';
import type {
  ExtractConfig,
  ExtractedPackageRule,
  NpmrcPackageFile,
} from '../../types.ts';
import { PnpmWorkspaceMinimumReleaseAge } from '../schema.ts';
import type { NpmManagerData } from '../types.ts';
import { parseNpmrcPnpmMinimumReleaseAge } from './npmrc.ts';
import { resolvePnpmConstraint } from './pnpm.ts';
import type { PnpmMinimumReleaseAgeExclude } from './types.ts';

// pnpm reads only auth and registry settings from `.npmrc` since v11.0.0
// https://github.com/pnpm/pnpm/releases/tag/v11.0.0
export const pnpmNpmrcMinimumReleaseAgeRange = '<11.0.0';

// pnpm defaults `minimumReleaseAge` to 1 day since v11.0.0
// https://github.com/pnpm/pnpm/releases/tag/v11.0.0
export const pnpmDefaultMinimumReleaseAgeRange = '>=11.0.0';
export const pnpmDefaultMinimumReleaseAgeMinutes = 1440;

/**
 * Reads the minimum release age settings of the `pnpm-workspace.yaml` next to a pnpm lock file.
 *
 * pnpm sets `minimumReleaseAge` in minutes.
 */
export async function readPnpmWorkspaceMinimumReleaseAge(
  pnpmLockFile: string,
): Promise<PnpmWorkspaceMinimumReleaseAge> {
  const workspaceFile = upath.join(
    upath.dirname(pnpmLockFile),
    'pnpm-workspace.yaml',
  );
  const content = await readLocalFile(workspaceFile, 'utf8');
  if (!content) {
    return {};
  }
  const parsed = PnpmWorkspaceMinimumReleaseAge.safeParse(content);
  if (!parsed.success) {
    logger.debug(
      { workspaceFile, err: parsed.error },
      'Failed to parse the minimum release age of pnpm-workspace.yaml',
    );
    return {};
  }
  return parsed.data;
}

/**
 * The `minimumReleaseAge` in minutes which pnpm configures itself.
 *
 * The `pnpm-workspace.yaml` wins over the `.npmrc`, which pnpm reads only before v11.
 * With `includeDefault`, the pnpm default applies if neither sets it and the pnpm version may be v11 or later.
 * An unknown pnpm version counts as the latest pnpm.
 */
export function getPnpmMinimumReleaseAgeMinutes(
  workspace: PnpmWorkspaceMinimumReleaseAge,
  npmrcContent: string | null | undefined,
  pnpmConstraint: string | null | undefined,
  includeDefault = false,
): number | undefined {
  if (workspace.minimumReleaseAge !== undefined) {
    return workspace.minimumReleaseAge;
  }
  const npmrcMinutes = isSubsetOf(
    npmVersioning,
    pnpmConstraint,
    pnpmNpmrcMinimumReleaseAgeRange,
  )
    ? parseNpmrcPnpmMinimumReleaseAge(npmrcContent)
    : null;
  if (npmrcMinutes !== null) {
    return npmrcMinutes;
  }
  const isKnownVersion =
    isNonEmptyString(pnpmConstraint) && npmVersioning.isValid(pnpmConstraint);
  const mayHaveDefault =
    !isKnownVersion ||
    intersectsWith(
      npmVersioning,
      pnpmConstraint,
      pnpmDefaultMinimumReleaseAgeRange,
    );
  if (includeDefault && mayHaveDefault) {
    return pnpmDefaultMinimumReleaseAgeMinutes;
  }
  return undefined;
}

const plainPackageNameRegex = regEx(/^[\w./@~-]+$/);
const regexSpecialCharacterRegex = regEx(/[.*+?^${}()|[\]\\]/g);

/**
 * Translates a pnpm package name pattern to a `matchPackageNames` pattern, or returns `null` for a pattern which matches no package.
 *
 * In pnpm, `*` matches any characters including `/`, `?` matches one character, and a leading `!` matches every package which the rest of the pattern does not match. As Renovate globs do not cross `/`, a pattern with wildcards becomes a regex.
 */
export function toMatchPackageNamesPattern(pattern: string): string | null {
  const negated = pattern.startsWith('!');
  const body = negated ? pattern.slice(1) : pattern;
  const prefix = negated ? '!' : '';
  if (body === '*') {
    return negated ? null : '*';
  }
  if (plainPackageNameRegex.test(body)) {
    return `${prefix}${body}`;
  }
  const source = body
    .replace(regexSpecialCharacterRegex, '\\$&')
    .replaceAll('\\*', '.*')
    .replaceAll('\\?', '.');
  return `${prefix}/^${source}$/`;
}

/**
 * Parses the `minimumReleaseAgeExclude` entries of a `pnpm-workspace.yaml` like pnpm, which accepts a package name or name pattern, or a package name with a union of exact versions like `foo@1.0.0 || 2.0.0`.
 */
export function parsePnpmMinimumReleaseAgeExclude(
  entries: string[] | undefined,
): PnpmMinimumReleaseAgeExclude {
  const result: PnpmMinimumReleaseAgeExclude = {
    packageNames: [],
    versions: [],
  };
  for (const entry of coerceArray(entries)) {
    const atIndex = entry.indexOf('@', entry.startsWith('@') ? 1 : 0);
    const name = atIndex === -1 ? entry : entry.slice(0, atIndex);
    const packageName = toMatchPackageNamesPattern(name);
    if (!packageName) {
      logger.debug(
        `minimumReleaseAgeExclude entry ${entry} matches no package, ignoring`,
      );
      continue;
    }
    if (atIndex === -1) {
      result.packageNames.push(packageName);
      continue;
    }
    const versions = entry
      .slice(atIndex + 1)
      .split('||')
      .map((version) => semver.valid(version));
    // pnpm accepts exact versions only for a plain package name
    if (!plainPackageNameRegex.test(name) || versions.includes(null)) {
      logger.debug(`Invalid minimumReleaseAgeExclude entry ${entry}, ignoring`);
      continue;
    }
    result.versions.push({ packageName, versions: versions as string[] });
  }
  return result;
}

/**
 * Whether pnpm excludes `version` of `packageName` from its minimum release age.
 */
export function isPnpmMinimumReleaseAgeExcluded(
  exclude: PnpmMinimumReleaseAgeExclude,
  packageName: string,
  version: string | undefined,
): boolean {
  if (
    exclude.packageNames.some((pattern) =>
      matchRegexOrGlobList(packageName, [pattern]),
    )
  ) {
    return true;
  }
  return exclude.versions.some(
    (entry) =>
      !!version &&
      entry.versions.includes(version) &&
      matchRegexOrGlobList(packageName, [entry.packageName]),
  );
}

/**
 * The `packageRules` for a pnpm minimum release age, which pnpm applies to npm packages only, and which `minimumReleaseAgeExclude` lifts for every version of the packages it names.
 *
 * Entries with exact versions get no rule, as Renovate does not look up other versions with a different age.
 */
export function getPnpmMinimumReleaseAgeRules(
  minutes: number,
  exclude: PnpmMinimumReleaseAgeExclude,
): ExtractedPackageRule[] {
  return [
    {
      matchDatasources: [NpmDatasource.id],
      minimumReleaseAgeExtracted: `${minutes} minutes`,
    },
    ...exclude.packageNames.map((packageName) => ({
      matchDatasources: [NpmDatasource.id],
      matchPackageNames: [packageName],
      minimumReleaseAgeExtracted: null,
    })),
  ];
}

/**
 * Adds `packageRules` with the pnpm minimum release age to the package files of each pnpm lock file, including its `pnpm-workspace.yaml`, from the `pnpm-workspace.yaml` `minimumReleaseAge`, before pnpm v11 the `minimum-release-age` of the merged `.npmrc` (the `npmrc` option and the repository `.npmrc`), or the pnpm v11 default, and keeps the `pnpm-workspace.yaml` settings in `managerData`.
 *
 * The pnpm version comes from the configured `constraints`, the root `package.json` or the lock file, like for the lock file update.
 */
export async function setPnpmMinimumReleaseAge(
  packageFiles: Partial<NpmrcPackageFile<NpmManagerData>>[],
  config: ExtractConfig,
): Promise<void> {
  const packageFilesByLockFile = new Map<
    string,
    Partial<NpmrcPackageFile<NpmManagerData>>[]
  >();
  for (const packageFile of packageFiles) {
    const pnpmLockFile = packageFile.managerData?.pnpmLockFile;
    if (pnpmLockFile) {
      const lockFilePackageFiles = packageFilesByLockFile.get(pnpmLockFile);
      if (lockFilePackageFiles) {
        lockFilePackageFiles.push(packageFile);
      } else {
        packageFilesByLockFile.set(pnpmLockFile, [packageFile]);
      }
    }
  }
  for (const [pnpmLockFile, lockFilePackageFiles] of packageFilesByLockFile) {
    const workspace = await readPnpmWorkspaceMinimumReleaseAge(pnpmLockFile);
    const { minimumReleaseAge, minimumReleaseAgeStrict } = workspace;
    const hasMinimumReleaseAgeExclude = isNonEmptyArray(
      workspace.minimumReleaseAgeExclude,
    );
    if (
      minimumReleaseAge !== undefined ||
      minimumReleaseAgeStrict !== undefined ||
      hasMinimumReleaseAgeExclude
    ) {
      for (const packageFile of lockFilePackageFiles) {
        packageFile.managerData!.pnpmWorkspaceMinimumReleaseAge = {
          minimumReleaseAge,
          minimumReleaseAgeStrict,
          ...(hasMinimumReleaseAgeExclude && { hasMinimumReleaseAgeExclude }),
        };
      }
    }
    // the pnpm-workspace.yaml has no .npmrc or pnpm constraint of its own, so
    // the root package.json sets them for every package file of the lock file
    const rootPackageFile = upath.join(
      upath.dirname(pnpmLockFile),
      'package.json',
    );
    const root =
      lockFilePackageFiles.find(
        (packageFile) => packageFile.packageFile === rootPackageFile,
      ) ?? lockFilePackageFiles.find((packageFile) => packageFile.npmrc);
    const pnpmConstraint = await resolvePnpmConstraint(
      config,
      pnpmLockFile,
      () => root?.extractedConstraints?.pnpm,
    );
    const minutes = getPnpmMinimumReleaseAgeMinutes(
      workspace,
      root?.npmrc,
      pnpmConstraint,
      true,
    );
    if (!minutes) {
      continue;
    }
    logger.debug(
      `Found pnpm minimum release age of ${minutes} minutes for ${pnpmLockFile}`,
    );
    const rules = getPnpmMinimumReleaseAgeRules(
      minutes,
      parsePnpmMinimumReleaseAgeExclude(workspace.minimumReleaseAgeExclude),
    );
    for (const packageFile of lockFilePackageFiles) {
      packageFile.packageRules = [
        ...coerceArray(packageFile.packageRules),
        ...rules,
      ];
    }
  }
}
