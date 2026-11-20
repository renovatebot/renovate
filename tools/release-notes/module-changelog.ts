export interface CommitTypeConfig {
  type: string;
  section?: string;
}

export interface ParsedCommit {
  type: string;
  scope: string | undefined;
  subject: string;
  breaking?: boolean;
  /** The release (tag) this commit was first shipped in, if known. Set by
   * `attributeReleases`, not `parseCommitHeader` — a single commit header
   * carries no information about which release it landed in. */
  release?: string;
}

export interface ModuleEntry {
  scope: string;
  label: string;
  commits: ParsedCommit[];
}

/** A `manager`/`datasource`/`versioning`/`platform`/`preset` scope, split
 * into its category and per-module entries, e.g. `manager` -> [`npm`,
 * `cargo`, ...]. */
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

/** Commits carrying a Conventional Commits `!` breaking-change marker,
 * pulled out into a leading section. These also still appear in their
 * normal category/flat group — this is a highlight, not a move. */
export interface BreakingGroup {
  kind: 'breaking';
  commits: ParsedCommit[];
}

export type ModuleGroup = CategoryGroup | FlatGroup | BreakingGroup;

const COMMIT_HEADER_RE =
  /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?:\s*(?<subject>.+)$/i;

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

  const { type, scope, subject, breaking } = match.groups;
  return {
    type: type.toLowerCase(),
    scope,
    subject,
    breaking: breaking === '!',
  };
}

function typeRank(types: CommitTypeConfig[], type: string): number {
  const rank = types.findIndex((entry) => entry.type === type);
  return rank === -1 ? types.length : rank;
}

// Matches GitHub's own trailing PR reference on a squash-merge commit
// subject, e.g. " (#45678)" or " (main) (#45678)" (the "(main)" part is
// semantic-release's channel marker, which Renovate's own bump commits
// carry). We replace this with which release the commit shipped in
// instead — more useful for tracing when something changed than a link to
// the PR that merged it.
const TRAILING_PR_REFERENCE_RE = /\s*(?:\([\w-]+\)\s*)?\(#\d+\)\s*$/;

/**
 * Strip a trailing GitHub PR reference (and any channel marker before it)
 * from a commit subject.
 */
export function stripPrReference(subject: string): string {
  return subject.replace(TRAILING_PR_REFERENCE_RE, '');
}

/**
 * Attribute each commit to the release it first shipped in.
 *
 * `orderedShas` must be oldest-to-newest, covering every commit in the
 * range up to (and including) the release being summarized. `releaseTagBySha`
 * maps a commit SHA to the release tag pointing directly at it, for every
 * commit in the repository that happens to be a release boundary (most
 * commits won't be in this map at all).
 *
 * A commit is attributed to the nearest release tag at or after it in
 * `orderedShas` — i.e. whichever release actually shipped it. A commit
 * with no release at or after it in the given range (for example, because
 * `orderedShas` doesn't reach all the way to a tagged commit) is left
 * unattributed.
 */
export function attributeReleases(
  orderedShas: string[],
  releaseTagBySha: ReadonlyMap<string, string>,
): Map<string, string> {
  const releaseBySha = new Map<string, string>();
  const pending: string[] = [];

  for (const sha of orderedShas) {
    pending.push(sha);
    const release = releaseTagBySha.get(sha);
    if (release) {
      for (const pendingSha of pending) {
        releaseBySha.set(pendingSha, release);
      }
      pending.length = 0;
    }
  }

  return releaseBySha;
}

/**
 * Drop commits that are exact repeats of an earlier one in the same range
 * (same type, scope and subject) — for example a change that landed, got
 * reverted, and was reapplied verbatim. Keeps a running count on the
 * surviving entry rather than silently dropping the repeat.
 */
export function dedupeCommits(commits: ParsedCommit[]): ParsedCommit[] {
  const result: ParsedCommit[] = [];
  const indexByKey = new Map<string, number>();
  const countByKey = new Map<string, number>();

  for (const commit of commits) {
    const key = `${commit.type}::${commit.scope ?? ''}::${commit.subject}`;
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
      subject: `${commit.subject} (×${count})`,
    };
  }

  return result;
}

/**
 * Commit types hidden by default: implementation detail that rarely
 * matters to someone skimming what changed, as opposed to a behaviour
 * change. `docs`/`chore` stay visible by default — a docs fix can matter
 * to the reader, and `chore` is how Renovate's own dependency bumps are
 * typed (already deprioritised and collapsed via `CATEGORY_RANKS`/
 * `COLLAPSED_SCOPES`, rather than hidden outright).
 *
 * A commit with a breaking-change marker is always shown, regardless of
 * its type.
 */
export const HIDDEN_TYPES = new Set(['test', 'style', 'ci', 'refactor']);

/**
 * Drop commits whose type is in `hiddenTypes`, unless they're a breaking
 * change. Pass `new Set()` to disable filtering.
 */
export function filterHiddenTypes(
  commits: ParsedCommit[],
  hiddenTypes: ReadonlySet<string> = HIDDEN_TYPES,
): ParsedCommit[] {
  return commits.filter((commit) => {
    if (commit.breaking) {
      return true;
    }
    return !hiddenTypes.has(commit.type);
  });
}

/**
 * Scopes hidden by default: internal tooling that doesn't affect what
 * Renovate does for users, as opposed to a module or behaviour change.
 */
export const HIDDEN_SCOPES = new Set(['lint']);

/**
 * Drop commits whose scope is in `hiddenScopes`, unless they're a breaking
 * change. Pass `new Set()` to disable filtering.
 */
export function filterHiddenScopes(
  commits: ParsedCommit[],
  hiddenScopes: ReadonlySet<string> = HIDDEN_SCOPES,
): ParsedCommit[] {
  return commits.filter((commit) => {
    if (commit.breaking) {
      return true;
    }
    return !commit.scope || !hiddenScopes.has(commit.scope);
  });
}

/**
 * `type::scope` pairs hidden by default: internal bookkeeping that's
 * neither a module change nor something a user needs to know about, even
 * though `chore` and `renovate` aren't hidden on their own — a `chore`
 * touching a real module, or a `feat`/`fix` in this repo's own
 * `renovate.json5`, still shows.
 */
export const HIDDEN_TYPE_SCOPES = new Set(['chore::renovate']);

/**
 * Drop commits whose `type::scope` pair is in `hiddenTypeScopes`, unless
 * they're a breaking change. Pass `new Set()` to disable filtering.
 */
export function filterHiddenTypeScopes(
  commits: ParsedCommit[],
  hiddenTypeScopes: ReadonlySet<string> = HIDDEN_TYPE_SCOPES,
): ParsedCommit[] {
  return commits.filter((commit) => {
    if (commit.breaking) {
      return true;
    }
    return !hiddenTypeScopes.has(`${commit.type}::${commit.scope ?? ''}`);
  });
}

// Matches Renovate's own "docs: update references to X" / "docs: update
// references to X to Y" commits — bumps of example version pins embedded in
// the docs (see DEPENDENCY_UPDATE_RE below), not an actual documentation
// change, so these are dependency-bump noise wearing a `docs` type.
const UPDATE_REFERENCES_RE = /^update references to /i;

/**
 * Drop "docs: update references to ..." commits (example version pins in
 * the docs getting bumped), unless they're a breaking change. These carry
 * no scope of their own, so `filterHiddenScopes` can't catch them.
 */
export function filterHiddenDocsUpdates(
  commits: ParsedCommit[],
): ParsedCommit[] {
  return commits.filter((commit) => {
    if (commit.breaking) {
      return true;
    }
    return !(
      commit.type === 'docs' && UPDATE_REFERENCES_RE.test(commit.subject)
    );
  });
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

// A parsed "version" only counts if it actually looks like one (or a git
// SHA/digest) — otherwise ordinary prose like "update docs to mention the
// new option" gets misread as a dependency bump. This is on top of only
// running `consolidateDependencyBumps` for `COLLAPSED_SCOPES` scopes
// (below) — belt and braces, since those scopes are bot-authored and
// unlikely to contain non-dependency subjects in the first place.
const VERSION_LIKE_RE = /^(?:v?\d[\w.+-]*|[0-9a-f]{7,40})$/i;

interface DependencyUpdate {
  name: string;
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
  if (!match?.groups || !VERSION_LIKE_RE.test(match.groups.version)) {
    return undefined;
  }

  return {
    name: stripPinnedVersionSuffix(match.groups.name),
    text: match[0],
  };
}

/**
 * Collapse repeated "update X to Y" commits for the same dependency into a
 * single entry showing only the version it ended up at, plus how many
 * commits were folded in. Commits that aren't a recognised
 * dependency-update subject pass through unchanged.
 *
 * Only call this on a scope's commits when that scope is one of
 * `COLLAPSED_SCOPES` — dependency-bump phrasing ("update X to Y") isn't
 * unique to actual dependency bumps (e.g. "update docs to mention ..."),
 * so this is only safe to run where every commit is already known to be a
 * Renovate self-update.
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

    // Keyed on the dependency name alone, not the commit type — the same
    // dependency can be classified `feat`/`fix`/`chore` across different
    // bumps, and folding by type would leave stale, contradictory entries
    // (e.g. a `feat:` bump "stuck" at an old version once later bumps were
    // reclassified as `fix:`).
    const key = update.name.toLowerCase();
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
  // Documentation changes: not code, but still worth a reader's attention —
  // ranked just above the dependency updates noise below it.
  { pattern: /^docs$/, rank: 1.5 },
  // High-volume, low-signal dependency bumps: still worth listing, but
  // shouldn't crowd out everything else.
  { pattern: /^deps$/, rank: 2 },
  // Internal tooling, hidden by default (`HIDDEN_SCOPES`) and only ever
  // seen at all with `--all` — lowest priority when it is.
  { pattern: /^lint$/, rank: 3 },
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

/** Within the `deps` group, commit types whose change is visible to a
 * Renovate user (a new capability, a behaviour fix, or a build/release
 * change) as opposed to pure internal bookkeeping (`chore`, `ci`, ...). */
export const USER_FACING_DEPENDENCY_TYPES = new Set(['feat', 'fix', 'build']);

/** Display labels for flat (non-module) scopes whose raw name doesn't read
 * well as a heading. Any other scope falls back to its raw name. */
const FLAT_SCOPE_LABELS: Record<string, string> = {
  deps: 'Dependency updates',
  docs: 'Documentation',
};

// A commit scope's category can be written singular or plural
// (`manager/npm`, `managers/npm`) — both are normalised to the singular
// form, which is also the real `lib/modules/<category>` directory name.
const CATEGORY_ALIASES: Record<string, string> = {
  manager: 'manager',
  managers: 'manager',
  datasource: 'datasource',
  datasources: 'datasource',
  versioning: 'versioning',
  versionings: 'versioning',
  platform: 'platform',
  platforms: 'platform',
  preset: 'preset',
  presets: 'preset',
};

const MODULE_SCOPE_RE = new RegExp(
  `^(?<category>${Object.keys(CATEGORY_ALIASES).join('|')})(?:/(?<name>.+))?$`,
  'i',
);

interface ModuleScope {
  category: string;
  name: string | undefined;
}

/**
 * Parse a commit scope into a module category and name, accepting both
 * `manager/npm` and the plural `managers/npm`, and a bare category with no
 * specific module (`datasource` on its own). Returns `undefined` for
 * anything that isn't a module scope at all.
 */
function parseModuleScope(scope: string): ModuleScope | undefined {
  const match = MODULE_SCOPE_RE.exec(scope);
  if (!match?.groups) {
    return undefined;
  }

  return {
    category: CATEGORY_ALIASES[match.groups.category.toLowerCase()],
    name: match.groups.name,
  };
}

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
 *
 * A `preset` isn't a `lib/modules/` module — there's no `index.ts` to
 * import a `displayName` from — so its name is humanized directly, e.g.
 * `presets/monorepo` -> "Monorepo presets".
 */
async function resolveModuleLabel(scope: string): Promise<string> {
  const parsed = parseModuleScope(scope);
  if (!parsed?.name) {
    return scope;
  }

  if (parsed.category === 'preset') {
    return `${formatName(parsed.name)} presets`;
  }

  try {
    const definition = (await import(
      `../../lib/modules/${parsed.category}/${parsed.name}/index.ts`
    )) as { displayName?: string };
    return definition.displayName ?? formatName(parsed.name);
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
 * for example `manager/gitlab`) instead of by type.
 *
 * - A commit with a breaking-change marker (`!`) is always pulled into a
 *   leading `BreakingGroup`, in addition to (not instead of) its normal
 *   group below.
 * - A module scope (`manager/`, `datasource/`, `versioning/`, `platform/`,
 *   `preset/`, singular or plural, with or without a specific module name)
 *   becomes a module entry nested under a `CategoryGroup`; a bare category
 *   with no module name (`datasource` on its own) becomes a "General"
 *   entry in that same category, rather than a second, colliding group.
 *   The same module scoped under its singular and plural category alias
 *   (`manager/pep621` and `managers/pep621`) merges into that one entry
 *   too, rather than showing up as two separate, identically-labelled
 *   bullets.
 * - An unscoped `docs:` commit is treated as if scoped `docs`, joining any
 *   explicitly `docs`-scoped commits in their own "Documentation" group,
 *   rather than falling into "Other". A named (non-module) scope whose
 *   commits are *all* `docs:` (e.g. `docs(community-tools): ...`) joins
 *   that same "Documentation" group too, rather than getting its own
 *   raw-scope heading — its scope is kept inline per commit
 *   (`docs(community-tools): ...`) since the shared heading can't show
 *   it. A scope with a mix of `docs:` and other types keeps its own
 *   heading.
 * - Everything else becomes its own `FlatGroup`, with the scope-less group
 *   labelled "Other" — however few commits it has, so a scope stays
 *   scannable as its own heading.
 *
 * Category groups are sorted alphabetically by category name, and the
 * modules inside a category alphabetically by `label`. Flat groups are
 * sorted by `categoryRank` then alphabetically by `label`, with "Other"
 * last. Commits inside a group are sorted by their type's position in
 * `types`, i.e. the same priority order `.releaserc.json` already assigns
 * each Conventional Commit type.
 */
export function groupByModule(
  commits: ParsedCommit[],
  types: CommitTypeConfig[],
  labels: ReadonlyMap<string, string>,
): ModuleGroup[] {
  const breaking = commits.filter((commit) => commit.breaking);

  const byScope = new Map<string | undefined, ParsedCommit[]>();
  for (const commit of commits) {
    // An unscoped `docs:` commit (no `docs(scope):`) would otherwise fall
    // into the catch-all "Other" group below; file it alongside any
    // explicitly `docs`-scoped commits instead, under its own heading.
    const scope =
      commit.scope === undefined && commit.type === 'docs'
        ? 'docs'
        : commit.scope;
    const existing = byScope.get(scope);
    if (existing) {
      existing.push(commit);
    } else {
      byScope.set(scope, [commit]);
    }
  }

  // Keyed by module name (the empty string for a bare category, i.e.
  // "General") so that `manager/pep621` and `managers/pep621` — the same
  // module, written with the singular vs. plural category alias — land in
  // one entry instead of two duplicate-looking bullets in the same
  // category section.
  const modulesByCategory = new Map<string, Map<string, ModuleEntry>>();
  const flat: FlatGroup[] = [];

  for (const [scope, rawCommits] of byScope) {
    const groupCommits =
      scope && COLLAPSED_SCOPES.has(scope)
        ? consolidateDependencyBumps(rawCommits)
        : rawCommits;
    groupCommits.sort(
      (a, b) => typeRank(types, a.type) - typeRank(types, b.type),
    );

    const parsed = scope ? parseModuleScope(scope) : undefined;
    if (scope && parsed) {
      const nameKey = parsed.name ?? '';
      const entries =
        modulesByCategory.get(parsed.category) ??
        new Map<string, ModuleEntry>();
      modulesByCategory.set(parsed.category, entries);

      const existing = entries.get(nameKey);
      if (existing) {
        existing.commits.push(...groupCommits);
      } else {
        entries.set(nameKey, {
          scope,
          label: parsed.name ? (labels.get(scope) ?? scope) : 'General',
          commits: groupCommits,
        });
      }
      continue;
    }

    flat.push({
      kind: 'flat',
      scope,
      label: scope ? (FLAT_SCOPE_LABELS[scope] ?? scope) : 'Other',
      commits: groupCommits,
      totalCommits: rawCommits.length,
    });
  }

  // A named (non-module) scope whose commits are *all* `docs:` reads
  // oddly headed by that raw scope name — e.g. "community-tools" — when a
  // reader skimming for documentation changes would only think to look
  // under "Documentation". Fold it into the same "Documentation" bucket
  // an unscoped `docs:` commit already joins, keeping the original scope
  // inline on each commit line (`docs(community-tools): ...`) since the
  // shared heading can't show every merged-in scope at once.
  let docsGroup = flat.find((group) => group.scope === 'docs');
  for (let i = flat.length - 1; i >= 0; i--) {
    const group = flat[i];
    if (
      group.scope === undefined ||
      group.scope === 'docs' ||
      !group.commits.every((commit) => commit.type === 'docs')
    ) {
      continue;
    }

    if (!docsGroup) {
      docsGroup = {
        kind: 'flat',
        scope: 'docs',
        label: 'Documentation',
        commits: [],
        totalCommits: 0,
      };
      flat.push(docsGroup);
    }
    docsGroup.commits.push(...group.commits);
    docsGroup.totalCommits += group.totalCommits;
    flat.splice(i, 1);
  }
  if (docsGroup) {
    docsGroup.commits.sort(
      (a, b) => typeRank(types, a.type) - typeRank(types, b.type),
    );
  }

  const categoryGroups: CategoryGroup[] = [];
  for (const [category, entries] of modulesByCategory) {
    const modules = Array.from(entries.values());
    for (const module of modules) {
      // Re-sort: a module merged from more than one raw scope alias is the
      // concatenation of two already-sorted lists, which isn't sorted as
      // a whole.
      module.commits.sort(
        (a, b) => typeRank(types, a.type) - typeRank(types, b.type),
      );
    }
    // "General" (a bare category scope with no specific module) is a
    // catch-all, not a module in its own right — keep it last regardless
    // of where it'd otherwise fall alphabetically.
    modules.sort((a, b) => {
      if (a.label === 'General') {
        return b.label === 'General' ? 0 : 1;
      }
      if (b.label === 'General') {
        return -1;
      }
      return a.label.localeCompare(b.label);
    });
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

  const groups: ModuleGroup[] = [...categoryGroups, ...flat];
  if (breaking.length > 0) {
    groups.unshift({ kind: 'breaking', commits: breaking });
  }

  return groups;
}

function renderReleaseLink(commit: ParsedCommit, repo: string): string {
  if (!commit.release) {
    return '';
  }
  return ` ([${commit.release}](https://github.com/${repo}/releases/tag/${commit.release}))`;
}

function renderCommitLine(
  commit: ParsedCommit,
  repo: string,
  scope?: string,
): string {
  const type = scope ? `${commit.type}(${scope})` : commit.type;
  return `- ${type}: ${commit.subject}${renderReleaseLink(commit, repo)}`;
}

/** Render `commits` as a collapsed `<details>` block with the given
 * `<summary>` text, or nothing at all if there are no commits to show. */
function renderDetails(
  summary: string,
  commits: ParsedCommit[],
  repo: string,
): string[] {
  if (commits.length === 0) {
    return [];
  }
  return [
    '<details>',
    `<summary>${summary}</summary>`,
    '',
    ...commits.map((commit) => renderCommitLine(commit, repo)),
    '',
    '</details>',
  ];
}

/**
 * Render module groups as `###` headings over a Markdown list, linking each
 * commit to the release it shipped in (when known), for example:
 *
 * ### Breaking changes
 *
 * - `manager/npm` fix!: drop support for npm 6 ([44.61.4](...))
 *
 * ### manager
 *
 * - Cargo
 *   - fix: support ~latest component refs ([44.61.3](...))
 *
 * ### Dependency updates
 *
 * <details>
 * <summary>1 user-facing updates</summary>
 *
 * - build: update dependency bar to v4.5.6 ([44.61.4](...))
 *
 * </details>
 *
 * <details>
 * <summary>1 other updates</summary>
 *
 * - chore: update dependency foo to v1.2.3 ([44.61.3](...))
 *
 * </details>
 *
 * ### Other
 *
 * - docs: add warning to `checkedBranches`
 */
export function renderModuleChangelog(
  groups: ModuleGroup[],
  repo: string,
): string {
  const sections: string[] = [];
  for (const group of groups) {
    const lines: string[] = [];

    if (group.kind === 'breaking') {
      lines.push('### Breaking changes', '');
      for (const commit of group.commits) {
        const scopePrefix = commit.scope ? `\`${commit.scope}\` ` : '';
        lines.push(
          `- ${scopePrefix}${commit.type}!: ${commit.subject}${renderReleaseLink(commit, repo)}`,
        );
      }
      sections.push(lines.join('\n'));
      continue;
    }

    if (group.kind === 'category') {
      lines.push(`### ${group.category}`, '');
      for (const module of group.modules) {
        lines.push(`- ${module.label}`);
        for (const commit of module.commits) {
          lines.push(`  ${renderCommitLine(commit, repo)}`);
        }
      }
      sections.push(lines.join('\n'));
      continue;
    }

    lines.push(`### ${group.label}`, '');

    if (group.scope === 'deps') {
      // Split into what a Renovate user would actually care about
      // (`feat`/`fix`/`build`) versus internal bookkeeping (mostly
      // `chore`), each in its own collapsed block, rather than one long
      // undifferentiated list.
      const userFacing = group.commits.filter((commit) =>
        USER_FACING_DEPENDENCY_TYPES.has(commit.type),
      );
      const other = group.commits.filter(
        (commit) => !USER_FACING_DEPENDENCY_TYPES.has(commit.type),
      );
      const blocks = [
        renderDetails(
          `${userFacing.length} user-facing updates`,
          userFacing,
          repo,
        ),
        renderDetails(`${other.length} other updates`, other, repo),
      ].filter((block) => block.length > 0);
      lines.push(blocks.map((block) => block.join('\n')).join('\n\n'));
      sections.push(lines.join('\n'));
      continue;
    }

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
      // The "Documentation" bucket (`group.scope === 'docs'`) can hold
      // commits merged in from several different original scopes — show
      // each one inline, since the shared heading can't. Every other flat
      // group has a single scope already named by its own heading.
      const inlineScope =
        group.scope === 'docs' && commit.scope && commit.scope !== 'docs'
          ? commit.scope
          : undefined;
      lines.push(renderCommitLine(commit, repo, inlineScope));
    }

    if (collapse) {
      lines.push('', '</details>');
    }

    sections.push(lines.join('\n'));
  }
  return sections.join('\n\n');
}

/**
 * Neutralise `@name` sequences (`@biomejs/biome`, `@types/luxon`, ...) so
 * `linkify()` (remark-github) doesn't misread an npm-scoped package name as
 * a GitHub `@mention` and turn it into a broken profile link, e.g.
 * `@types/luxon` -> a fabricated link to `github.com/types/luxon`. Skips
 * code spans and URLs, and leaves an email-like `name@host` alone — same
 * approach as `sanitizeMarkdown` in `lib/util/markdown.ts`, but narrower:
 * that helper also neutralises bare `#1234` references, which would stop
 * `linkify()` from turning them into real links, so it can't be reused
 * as-is here (`linkify()` runs after this, not before).
 */
const ZERO_WIDTH_SPACE = '\u200B';

export function escapeMentions(markdown: string): string {
  const escaped = markdown
    .split(/(?<skip>```[\s\S]*?```|`[^`\n]*?`|https?:\/\/[^\s<]+)/g)
    .map((part) =>
      part.startsWith('`') || /^https?:\/\//i.test(part)
        ? part
        : part.replace(/@/g, `@${ZERO_WIDTH_SPACE}`),
    )
    .join('');
  return escaped.replace(
    new RegExp(`([a-z])@${ZERO_WIDTH_SPACE}`, 'gi'),
    '$1@',
  );
}
