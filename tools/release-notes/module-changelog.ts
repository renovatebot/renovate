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

export interface ModuleGroup {
  scope: string | undefined;
  label: string;
  commits: ParsedCommit[];
}

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
 * for example `manager/gitlab`) instead of by type. Commits with no scope
 * are collected under `scope: undefined` ("Other").
 *
 * Groups are sorted by `categoryRank`, then alphabetically by `label`
 * within a rank; the scope-less group is always last. Commits inside each
 * group are sorted by their type's position in `types`, i.e. the same
 * priority order `.releaserc.json` already assigns each Conventional
 * Commit type.
 */
export function groupByModule(
  commits: ParsedCommit[],
  types: CommitTypeConfig[],
  labels: ReadonlyMap<string, string>,
): ModuleGroup[] {
  const groups = new Map<string | undefined, ParsedCommit[]>();
  for (const commit of commits) {
    const existing = groups.get(commit.scope);
    if (existing) {
      existing.push(commit);
    } else {
      groups.set(commit.scope, [commit]);
    }
  }

  const result: ModuleGroup[] = [];
  for (const [scope, groupCommits] of groups) {
    groupCommits.sort(
      (a, b) => typeRank(types, a.type) - typeRank(types, b.type),
    );
    result.push({
      scope,
      label: scope ? (labels.get(scope) ?? scope) : 'Other',
      commits: groupCommits,
    });
  }

  result.sort((a, b) => {
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

  return result;
}

/**
 * Render module groups as a nested Markdown list, for example:
 *
 * - Cargo
 *   - fix: support ~latest component refs
 * - deps
 *   <details>
 *   <summary>2 updates</summary>
 *
 *   - chore: update dependency foo to v1.2.3
 *   - build: update dependency bar to v4.5.6
 *
 *   </details>
 * - Other
 *   - docs: add warning to `checkedBranches`
 */
export function renderModuleChangelog(groups: ModuleGroup[]): string {
  const lines: string[] = [];
  for (const group of groups) {
    lines.push(`- ${group.label}`);
    const collapse =
      group.scope !== undefined && COLLAPSED_SCOPES.has(group.scope);

    if (collapse) {
      lines.push('  <details>');
      lines.push(`  <summary>${group.commits.length} updates</summary>`);
      lines.push('');
    }

    for (const commit of group.commits) {
      lines.push(`  - ${commit.type}: ${commit.subject}`);
    }

    if (collapse) {
      lines.push('');
      lines.push('  </details>');
    }
  }
  return lines.join('\n');
}
