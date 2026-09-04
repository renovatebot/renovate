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

/**
 * Group commits by their Conventional Commits scope (Renovate's modules,
 * for example `manager/gitlab`) instead of by type. Commits with no scope
 * are collected under `scope: undefined` ("Other").
 *
 * Groups are sorted alphabetically by scope, with the scope-less group
 * last. Commits inside each group are sorted by their type's position in
 * `types`, i.e. the same priority order `.releaserc.json` already assigns
 * each Conventional Commit type.
 */
export function groupByModule(
  commits: ParsedCommit[],
  types: CommitTypeConfig[],
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
    result.push({ scope, commits: groupCommits });
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
    return a.scope.localeCompare(b.scope);
  });

  return result;
}

/**
 * Render module groups as a nested Markdown list, for example:
 *
 * - manager/gitlab
 *   - fix: support ~latest component refs
 * - Other
 *   - docs: add warning to `checkedBranches`
 */
export function renderModuleChangelog(groups: ModuleGroup[]): string {
  const lines: string[] = [];
  for (const group of groups) {
    lines.push(`- ${group.scope ?? 'Other'}`);
    for (const commit of group.commits) {
      lines.push(`  - ${commit.type}: ${commit.subject}`);
    }
  }
  return lines.join('\n');
}
