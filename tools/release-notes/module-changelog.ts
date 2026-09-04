export interface CommitTypeConfig {
  type: string;
  section?: string;
  hidden?: boolean;
}

export interface ParsedCommit {
  type: string;
  scope: string | undefined;
  subject: string;
}

export interface ModuleEntry {
  scope: string;
  label: string;
  commits: ParsedCommit[];
}

/** A `manager`/`datasource`/`versioning`/`platform` scope, split into its
 * category and per-module entries, e.g. `manager` -> [`npm`, `cargo`, ...]. */
export interface CategoryGroup {
  kind: 'category';
  category: string;
  modules: ModuleEntry[];
}

/** Anything that isn't a module scope: a bare named scope (`workers/
 * repository`, `deps`), or no scope at all (`label: 'Other'`). */
export interface FlatGroup {
  kind: 'flat';
  scope: string | undefined;
  label: string;
  commits: ParsedCommit[];
  /** Commits in this group before `consolidateDependencyBumps` folded
   * repeated dependency bumps together; `>= commits.length`. */
  totalCommits: number;
}

export type ModuleGroup = CategoryGroup | FlatGroup;

const COMMIT_HEADER_RE =
  /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?!?:\s*(?<subject>.+)$/i;

/**
 * Parse a single-line Conventional Commits header (`type(scope): subject`)
 * into its parts. Returns `undefined` for anything that isn't a
 * Conventional Commit, for example a merge commit.
 */
export function parseCommitHeader(header: string): ParsedCommit | undefined {
  const match = COMMIT_HEADER_RE.exec(header.trim());
  if (!match?.groups) {
    return undefined;
  }

  const { type, scope, subject } = match.groups;
  return {
    type: type.toLowerCase(),
    scope,
    subject,
  };
}

function typeRank(types: CommitTypeConfig[], type: string): number {
  const rank = types.findIndex((entry) => entry.type === type);
  return rank === -1 ? types.length : rank;
}

// Matches Renovate's own "update dependency X to Y", "update X docker tag
// to Y", "update X action to Y", "update X monorepo to Y" commit subjects.
// This only ever looks at a single commit's own header/title. A commit's
// body can carry a much richer `| datasource | package | from | to |`
// table (see `getCommitHeaders` in summarize.ts), but parsing that means
// fetching full commit history, which is only affordable for this
// standalone tool, not for something that would run on every changelog
// fetch in the real product — so this stays title-only on purpose.
const DEPENDENCY_UPDATE_RE =
  /^update (?:dependency )?(?<name>.+?)(?: (?:docker tag|action|monorepo))? to (?<version>v?[^\s(]+)/i;

interface DependencyUpdate {
  name: string;
  version: string;
  text: string;
}

function stripPinnedVersionSuffix(name: string): string {
  const at = name.lastIndexOf('@');
  // Keep a leading `@` (a scoped package name like `@biomejs/biome`); only
  // strip a trailing `@<version>` pin, e.g. `protobufjs@8.0.1` -> `protobufjs`.
  return at > 0 ? name.slice(0, at) : name;
}

function parseDependencyUpdate(subject: string): DependencyUpdate | undefined {
  const match = DEPENDENCY_UPDATE_RE.exec(subject);
  if (!match?.groups) {
    return undefined;
  }

  return {
    name: stripPinnedVersionSuffix(match.groups.name),
    version: match.groups.version,
    text: match[0],
  };
}

/**
 * Collapse repeated "update X to Y" commits for the same dependency (and
 * commit type) into a single entry showing only the version it ended up
 * at, plus how many commits were folded in. Commits that aren't a
 * recognised dependency-update subject pass through unchanged.
 */
export function consolidateDependencyBumps(
  commits: ParsedCommit[],
): ParsedCommit[] {
  const result: ParsedCommit[] = [];
  const indexByKey = new Map<string, number>();
  const countByKey = new Map<string, number>();

  for (const commit of commits) {
    const update = parseDependencyUpdate(commit.subject);
    if (!update) {
      result.push(commit);
      continue;
    }

    const key = `${commit.type}::${update.name.toLowerCase()}`;
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, result.length);
      countByKey.set(key, 1);
      result.push(commit);
      continue;
    }

    const count = (countByKey.get(key) ?? 1) + 1;
    countByKey.set(key, count);
    result[existingIndex] = {
      ...commit,
      subject: `${update.text} (${count} updates)`,
    };
  }

  return result;
}

interface CategoryRank {
  pattern: RegExp;
  rank: number;
}

/**
 * Where a commit's scope sorts, lower first. A scope matching no pattern
 * falls back to `DEFAULT_CATEGORY_RANK`. Commits with no scope always
 * render in a trailing "Other" group, regardless of rank.
 *
 * Edit this list to change what counts as "user-facing" for prioritising
 * the changelog.
 */
export const CATEGORY_RANKS: CategoryRank[] = [
  // Ecosystem-specific modules (managers, datasources, versionings,
  // platforms) matter most to a reader unfamiliar with Renovate's own
  // internals, so they lead the changelog.
  { pattern: /^(?:manager|datasource|versioning|platform)\//, rank: 0 },
  // High-volume, low-signal dependency bumps: still worth listing, but
  // shouldn't crowd out everything else.
  { pattern: /^deps$/, rank: 2 },
];
const DEFAULT_CATEGORY_RANK = 1;

export function categoryRank(scope: string): number {
  for (const { pattern, rank } of CATEGORY_RANKS) {
    if (pattern.test(scope)) {
      return rank;
    }
  }
  return DEFAULT_CATEGORY_RANK;
}

/** Scopes rendered as a collapsed `<details>` block, for verbosity. */
export const COLLAPSED_SCOPES = new Set(['deps']);

const MODULE_CATEGORIES = new Set([
  'manager',
  'datasource',
  'versioning',
  'platform',
]);

const MODULE_SCOPE_RE = new RegExp(
  `^(?<category>${Array.from(MODULE_CATEGORIES).join('|')})/(?<name>.+)$`,
);

function formatName(input: string): string {
  return input
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Resolve a commit scope to a display label. For a module scope (for
 * example `versioning/cargo`), this imports `lib/modules/versioning/cargo/
 * index.ts` and uses its `displayName` export, matching what our own docs
 * generation (`tools/docs/`) already does. Falls back to a humanized module
 * name, or the raw scope, when there is no `displayName` to find.
 */
async function resolveModuleLabel(scope: string): Promise<string> {
  const [category, name] = scope.split('/');
  if (!name || !MODULE_CATEGORIES.has(category)) {
    return scope;
  }

  try {
    const definition = (await import(
      `../../lib/modules/${category}/${name}/index.ts`
    )) as { displayName?: string };
    return definition.displayName ?? formatName(name);
  } catch {
    return scope;
  }
}

/**
 * Resolve display labels for a set of commit scopes. See
 * `resolveModuleLabel` for how each scope is resolved.
 */
export async function resolveModuleLabels(
  scopes: Iterable<string>,
): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  await Promise.all(
    Array.from(new Set(scopes)).map(async (scope) => {
      labels.set(scope, await resolveModuleLabel(scope));
    }),
  );
  return labels;
}

/**
 * Group commits by their Conventional Commits scope (Renovate's modules,
 * for example `manager/gitlab`) instead of by type. A module scope (one of
 * `manager/`, `datasource/`, `versioning/`, `platform/`) becomes a module
 * entry nested under a category group (`manager`, ...); everything else
 * (a bare named scope, or no scope at all) becomes its own flat group,
 * with the scope-less group labelled "Other".
 *
 * Category groups always lead, sorted alphabetically by category name; the
 * modules inside a category are sorted alphabetically by `label`. Flat
 * groups follow, sorted by `categoryRank` then alphabetically by `label`,
 * with the scope-less group last. Commits inside a group are sorted by
 * their type's position in `types`, i.e. the same priority order
 * `.releaserc.json` already assigns each Conventional Commit type.
 */
export function groupByModule(
  commits: ParsedCommit[],
  types: CommitTypeConfig[],
  labels: ReadonlyMap<string, string>,
): ModuleGroup[] {
  const byScope = new Map<string | undefined, ParsedCommit[]>();
  for (const commit of commits) {
    const existing = byScope.get(commit.scope);
    if (existing) {
      existing.push(commit);
    } else {
      byScope.set(commit.scope, [commit]);
    }
  }

  const modulesByCategory = new Map<string, ModuleEntry[]>();
  const flat: FlatGroup[] = [];

  for (const [scope, rawCommits] of byScope) {
    const groupCommits = consolidateDependencyBumps(rawCommits);
    groupCommits.sort(
      (a, b) => typeRank(types, a.type) - typeRank(types, b.type),
    );

    const match = scope ? MODULE_SCOPE_RE.exec(scope) : null;
    if (scope && match?.groups) {
      const { category } = match.groups;
      const entry: ModuleEntry = {
        scope,
        label: labels.get(scope) ?? scope,
        commits: groupCommits,
      };
      const existing = modulesByCategory.get(category);
      if (existing) {
        existing.push(entry);
      } else {
        modulesByCategory.set(category, [entry]);
      }
      continue;
    }

    flat.push({
      kind: 'flat',
      scope,
      label: scope ?? 'Other',
      commits: groupCommits,
      totalCommits: rawCommits.length,
    });
  }

  const categoryGroups: CategoryGroup[] = [];
  for (const [category, modules] of modulesByCategory) {
    modules.sort((a, b) => a.label.localeCompare(b.label));
    categoryGroups.push({ kind: 'category', category, modules });
  }
  categoryGroups.sort((a, b) => a.category.localeCompare(b.category));

  flat.sort((a, b) => {
    if (!a.scope && !b.scope) {
      return 0;
    }
    if (!a.scope) {
      return 1;
    }
    if (!b.scope) {
      return -1;
    }
    const rankDiff = categoryRank(a.scope) - categoryRank(b.scope);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return a.label.localeCompare(b.label);
  });

  return [...categoryGroups, ...flat];
}

/**
 * Render module groups as `###` headings over a Markdown list, for example:
 *
 * ### manager
 *
 * - Cargo
 *   - fix: support ~latest component refs
 *
 * ### deps
 *
 * <details>
 * <summary>2 updates</summary>
 *
 * - chore: update dependency foo to v1.2.3
 * - build: update dependency bar to v4.5.6
 *
 * </details>
 *
 * ### Other
 *
 * - docs: add warning to `checkedBranches`
 */
export function renderModuleChangelog(groups: ModuleGroup[]): string {
  const sections: string[] = [];
  for (const group of groups) {
    const lines: string[] = [];

    if (group.kind === 'category') {
      lines.push(`### ${group.category}`, '');
      for (const module of group.modules) {
        lines.push(`- ${module.label}`);
        for (const commit of module.commits) {
          lines.push(`  - ${commit.type}: ${commit.subject}`);
        }
      }
      sections.push(lines.join('\n'));
      continue;
    }

    lines.push(`### ${group.label}`, '');
    const collapse =
      group.scope !== undefined && COLLAPSED_SCOPES.has(group.scope);

    if (collapse) {
      lines.push(
        '<details>',
        `<summary>${group.totalCommits} updates</summary>`,
        '',
      );
    }

    for (const commit of group.commits) {
      lines.push(`- ${commit.type}: ${commit.subject}`);
    }

    if (collapse) {
      lines.push('', '</details>');
    }

    sections.push(lines.join('\n'));
  }
  return sections.join('\n\n');
}
