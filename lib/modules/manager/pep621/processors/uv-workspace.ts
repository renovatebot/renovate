import upath from 'upath';
import { logger } from '../../../../logger/index.ts';
import * as memCache from '../../../../util/cache/memory/index.ts';
import { localPathExists, readLocalFile } from '../../../../util/fs/index.ts';
import { minimatch } from '../../../../util/minimatch.ts';
import {
  massage as massageToml,
  parse as parseToml,
} from '../../../../util/toml.ts';
import { PyProject, type UvConfig } from '../schema.ts';

/**
 * Fields a uv workspace root contributes to its members during resolution.
 *
 * Only the fields uv actually inherits (per the workspace docs) are tracked
 * here. Other `[tool.uv]` fields (`dev-dependencies`, `required-version`,
 * `workspace`, etc.) are member-local and do not appear in this type.
 *
 * @see https://docs.astral.sh/uv/concepts/projects/workspaces/
 */
export interface InheritedUvConfig {
  /** `[tool.uv.sources]` from the workspace root (PEP-508-normalized keys). */
  sources: NonNullable<UvConfig['sources']>;
  /** `[[tool.uv.index]]` entries from the workspace root. */
  indexes: NonNullable<UvConfig['index']>;
  /** The workspace root's pyproject path. Used for logging only. */
  rootPath: string;
}

const cacheKeyPrefix = 'pep621-uv-workspace-pyproject:';
const NULL_MARKER = Symbol('null');

async function loadPyProjectCached(path: string): Promise<PyProject | null> {
  const cacheKey = `${cacheKeyPrefix}${path}`;
  const cached = memCache.get<PyProject | typeof NULL_MARKER | undefined>(
    cacheKey,
  );
  if (cached !== undefined) {
    return cached === NULL_MARKER ? null : cached;
  }
  let parsed: PyProject | null = null;
  try {
    const content = await readLocalFile(path, 'utf8');
    if (content) {
      parsed = PyProject.parse(parseToml(massageToml(content)));
    }
  } catch (err) {
    logger.debug(
      { path, err },
      'pep621/uv: failed to parse candidate workspace pyproject.toml',
    );
  }
  memCache.set(cacheKey, parsed ?? NULL_MARKER);
  return parsed;
}

function matchesAny(
  memberRel: string,
  patterns: string[] | undefined,
): boolean {
  if (!patterns?.length) {
    return false;
  }
  // Normalize "."  (member at root) so glob comparisons behave.
  const target = memberRel === '' ? '.' : memberRel;
  return patterns.some((pattern) => {
    const mm = minimatch(pattern);
    return mm.match(target) || mm.match(`${target}/`);
  });
}

function* walkParentDirs(filePath: string): Generator<string> {
  let dir = upath.dirname(filePath);
  while (true) {
    const parent = upath.dirname(dir);
    if (parent === dir) {
      break;
    }
    const candidate =
      parent === '.' ? 'pyproject.toml' : upath.join(parent, 'pyproject.toml');
    yield candidate;
    if (parent === '.') {
      break;
    }
    dir = parent;
  }
}

/**
 * Walk strictly-ancestor directories looking for a pyproject.toml that
 * declares `[tool.uv.workspace]` and lists this member.
 *
 * Exported for tests; production callers should use `loadInheritedUvConfig`.
 */
export async function findUvWorkspaceRoot(
  memberPackageFile: string,
): Promise<{ rootPath: string; uv: UvConfig } | null> {
  let firstFound: { rootPath: string; uv: UvConfig } | null = null;
  for (const candidate of walkParentDirs(memberPackageFile)) {
    if (!(await localPathExists(candidate))) {
      continue;
    }
    const project = await loadPyProjectCached(candidate);
    const ws = project?.tool?.uv?.workspace;
    if (!ws) {
      continue;
    }
    const rootDir = upath.dirname(candidate);
    const memberDir = upath.dirname(memberPackageFile);
    const memberRel = upath.normalizeSafe(
      upath.relative(rootDir === '' ? '.' : rootDir, memberDir),
    );
    if (matchesAny(memberRel, ws.exclude)) {
      continue;
    }
    if (!matchesAny(memberRel, ws.members)) {
      continue;
    }
    if (firstFound) {
      // uv does not support nested workspaces; prefer the innermost match.
      logger.debug(
        { member: memberPackageFile, outerRoot: candidate },
        'pep621/uv: ignoring nested workspace root',
      );
      continue;
    }
    firstFound = { rootPath: candidate, uv: project.tool!.uv! };
  }
  return firstFound;
}

/**
 * If `memberPackageFile` belongs to a uv workspace, return the inherited
 * `[tool.uv.sources]` and `[[tool.uv.index]]` declared at the workspace
 * root. Returns null when the file is not a member of any workspace.
 *
 * The returned value contains *only* the bits uv actually inherits — not
 * a synthesized whole pyproject. Callers are expected to combine these
 * inherited entries with the member's own `[tool.uv]` at lookup time,
 * giving member entries precedence on key/name conflicts.
 */
export async function loadInheritedUvConfig(
  memberPackageFile: string,
): Promise<InheritedUvConfig | null> {
  const root = await findUvWorkspaceRoot(memberPackageFile);
  if (!root) {
    return null;
  }
  const sources = root.uv.sources;
  const indexes = root.uv.index;
  if (!sources && !indexes) {
    return null;
  }
  return {
    sources: sources ?? {},
    indexes: indexes ?? [],
    rootPath: root.rootPath,
  };
}
