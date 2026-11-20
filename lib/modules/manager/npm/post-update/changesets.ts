import { isString, isTruthy } from '@sindresorhus/is';
import type { Minimatch } from 'minimatch';
import upath from 'upath';
import { z } from 'zod/v4';
import { logger } from '../../../../logger/index.ts';
import { coerceArray } from '../../../../util/array.ts';
import { readLocalFile } from '../../../../util/fs/index.ts';
import { getFile } from '../../../../util/git/index.ts';
import type { FileChange } from '../../../../util/git/types.ts';
import { hash } from '../../../../util/hash.ts';
import { minimatch } from '../../../../util/minimatch.ts';
import { coerceObject } from '../../../../util/object.ts';
import { regEx } from '../../../../util/regex.ts';
import {
  Json,
  LooseArray,
  LooseRecord,
} from '../../../../util/schema-utils/index.ts';
import { api as semver } from '../../../versioning/npm/index.ts';
import type { PostUpdateConfig } from '../../types.ts';
import type { NpmManagerData } from '../types.ts';
import type { AdditionalPackageFiles } from './types.ts';

const changesetConfigFile = '.changeset/config.json';

const ChangesetConfig = Json.pipe(
  z.object({
    ignore: LooseArray(z.string()).catch([]),
  }),
);

const DependencySpecs = LooseRecord(z.string()).catch({});

const PackageJson = Json.pipe(
  z.object({
    name: z.string().optional().catch(undefined),
    private: z.boolean().optional().catch(undefined),
    dependencies: DependencySpecs.optional(),
    optionalDependencies: DependencySpecs.optional(),
    peerDependencies: DependencySpecs.optional(),
  }),
);
type PackageJson = z.infer<typeof PackageJson>;

const productionDepTypes = ['dependencies', 'optionalDependencies'] as const;

const catalogDepTypeRegex = regEx(/^(?:pnpm|yarn)\.catalog\.(?<catalog>.+)$/);

type BumpType = 'major' | 'patch';

interface DependencyChange {
  depName: string;
  catalog?: string;
  from?: string;
  to?: string;
}

interface Release {
  name: string;
  type: BumpType;
  changes: DependencyChange[];
}

/** Catalog name -> dependency name -> change, from the catalog upgrades in the branch */
type CatalogChanges = Map<string, Map<string, DependencyChange>>;

/**
 * Generates changesets which bump every published workspace package whose
 * `dependencies`, `optionalDependencies` or `peerDependencies` changed in the
 * branch, with one changeset per distinct set of dependency changes.
 */
export async function generateChangesets(
  config: PostUpdateConfig<NpmManagerData>,
  packageFiles: AdditionalPackageFiles,
): Promise<FileChange[]> {
  if (!config.postUpdateOptions?.includes('changesets')) {
    return [];
  }

  const ignore = await getChangesetIgnore();
  if (!ignore) {
    return [];
  }

  const releases = await getReleases(config, packageFiles, ignore);
  if (!releases.length) {
    logger.debug('No changeset generated: no published package changed');
    return [];
  }

  const changesets: FileChange[] = [];
  for (const [summary, group] of groupBySummary(releases)) {
    const contents = formatChangeset(group, summary);
    const path = `.changeset/renovate-${hash(contents, 'sha256').slice(0, 10)}.md`;
    logger.debug(
      `Generated changeset ${path} for ${group.map(({ name, type }) => `${name} (${type})`).join(', ')}`,
    );
    changesets.push({ type: 'addition', path, contents });
  }
  return changesets;
}

async function getChangesetIgnore(): Promise<string[] | null> {
  const content = await readLocalFile(changesetConfigFile, 'utf8');
  if (!content) {
    logger.debug(
      `No changeset generated: ${changesetConfigFile} does not exist`,
    );
    return null;
  }

  const parsed = ChangesetConfig.safeParse(content);
  if (!parsed.success) {
    logger.debug(
      { err: parsed.error },
      `No changeset generated: ${changesetConfigFile} is invalid`,
    );
    return null;
  }

  return parsed.data.ignore;
}

async function getReleases(
  config: PostUpdateConfig<NpmManagerData>,
  packageFiles: AdditionalPackageFiles,
  ignore: string[],
): Promise<Release[]> {
  const updatedContents = new Map<string, string>();
  for (const file of coerceArray(config.updatedPackageFiles)) {
    if (file.type === 'addition' && isString(file.contents)) {
      updatedContents.set(file.path, file.contents);
    }
  }

  const catalogChanges = getCatalogChanges(config);

  // a catalog update also changes the packages consuming it, which are not updated package files themselves
  const paths = new Set<string>();
  for (const { packageFile } of coerceArray(packageFiles.npm)) {
    if (
      isString(packageFile) &&
      upath.basename(packageFile) === 'package.json' &&
      (updatedContents.has(packageFile) || catalogChanges.size > 0)
    ) {
      paths.add(packageFile);
    }
  }

  const ignoreMatchers = ignore.map((pattern) => minimatch(pattern));
  const releases: (Release | null)[] = [];
  for (const path of [...paths].sort()) {
    releases.push(
      await getPackageRelease(
        path,
        updatedContents.get(path),
        config.baseBranch,
        ignoreMatchers,
        catalogChanges,
      ),
    );
  }

  return releases.filter(isTruthy).sort((a, b) => a.name.localeCompare(b.name));
}

async function getPackageRelease(
  path: string,
  updatedContent: string | undefined,
  baseBranch: string,
  ignoreMatchers: Minimatch[],
  catalogChanges: CatalogChanges,
): Promise<Release | null> {
  const after = parsePackageJson(
    updatedContent ?? (await readLocalFile(path, 'utf8')),
  );
  const name = after?.name;
  if (
    !name ||
    after.private ||
    ignoreMatchers.some((matcher) => matcher.match(name))
  ) {
    return null;
  }

  const before = updatedContent
    ? coerceObject(parsePackageJson(await getFile(path, baseBranch)))
    : after;
  return getRelease(name, before, after, catalogChanges);
}

function parsePackageJson(content: string | null): PackageJson | null {
  const parsed = PackageJson.safeParse(content);
  return parsed.success ? parsed.data : null;
}

function getCatalogChanges(
  config: PostUpdateConfig<NpmManagerData>,
): CatalogChanges {
  const catalogChanges: CatalogChanges = new Map();
  for (const upgrade of config.upgrades) {
    const catalog = catalogDepTypeRegex.exec(upgrade.depType ?? '')?.groups
      ?.catalog;
    if (!catalog || !upgrade.depName) {
      continue;
    }
    const changes = catalogChanges.get(catalog) ?? new Map();
    changes.set(upgrade.depName, {
      depName: upgrade.depName,
      catalog,
      from: upgrade.currentValue,
      to: upgrade.newValue,
    });
    catalogChanges.set(catalog, changes);
  }
  return catalogChanges;
}

function getRelease(
  name: string,
  before: PackageJson,
  after: PackageJson,
  catalogChanges: CatalogChanges,
): Release | null {
  const peerChanges = getDependencyChanges(
    before.peerDependencies,
    after.peerDependencies,
    catalogChanges,
  );
  const productionChanges = productionDepTypes.flatMap((depType) =>
    getDependencyChanges(before[depType], after[depType], catalogChanges),
  );

  const changes = [...peerChanges, ...productionChanges];
  if (!changes.length) {
    return null;
  }

  const type = peerChanges.some(isBreakingPeerChange) ? 'major' : 'patch';
  return { name, type, changes };
}

/**
 * A peer dependency change only breaks consumers if they now have to install
 * it, or if it no longer accepts a version they may use.
 */
function isBreakingPeerChange({ from, to }: DependencyChange): boolean {
  if (!to) {
    return false;
  }
  if (!from) {
    return true;
  }
  return !(
    semver.isValid(from) &&
    semver.isValid(to) &&
    semver.subset!(from, to)
  );
}

function getDependencyChanges(
  before: Record<string, string> = {},
  after: Record<string, string> = {},
  catalogChanges: CatalogChanges,
): DependencyChange[] {
  const changes: DependencyChange[] = [];
  const depNames = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const depName of depNames) {
    const from = before[depName];
    const to = after[depName];
    if (from !== to) {
      changes.push({ depName, from, to });
      continue;
    }

    if (to?.startsWith('catalog:')) {
      const catalog = to.slice('catalog:'.length) || 'default';
      const catalogChange = catalogChanges.get(catalog)?.get(depName);
      if (catalogChange) {
        changes.push(catalogChange);
      }
    }
  }
  return changes;
}

function formatChange({
  depName,
  catalog,
  from,
  to,
}: DependencyChange): string {
  const dep = catalog
    ? `\`${depName}\` (catalog \`${catalog}\`)`
    : `\`${depName}\``;
  if (!from) {
    return `- Added ${dep} at \`${to}\``;
  }
  if (!to) {
    return `- Removed ${dep}`;
  }
  return `- Updated ${dep} from \`${from}\` to \`${to}\``;
}

/**
 * Groups the releases by their summary, because changesets adds the summary
 * of a changeset to the changelog of every package it bumps.
 */
function groupBySummary(releases: Release[]): Map<string, Release[]> {
  const groups = new Map<string, Release[]>();
  for (const release of releases) {
    const summary = formatSummary(release.changes);
    groups.set(summary, [...coerceArray(groups.get(summary)), release]);
  }
  return groups;
}

function formatSummary(changes: DependencyChange[]): string {
  const sortedChanges = [...changes].sort((a, b) =>
    a.depName.localeCompare(b.depName),
  );
  const lines = new Set(sortedChanges.map(formatChange));
  return `Updated dependencies:\n\n${[...lines].join('\n')}`;
}

function formatChangeset(releases: Release[], summary: string): string {
  const bumps = releases.map(
    ({ name, type }) => `${JSON.stringify(name)}: ${type}`,
  );
  return `---\n${bumps.join('\n')}\n---\n\n${summary}\n`;
}
