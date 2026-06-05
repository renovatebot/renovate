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
  // Normalize a "."  (member at root) so glob comparisons behave.
  const target = memberRel === '' ? '.' : memberRel;
  return patterns.some((pattern) => {
    const mm = minimatch(pattern);
    return mm.match(target) || mm.match(`${target}/`);
  });
}

function* walkParentDirs(filePath: string): Generator<string> {
  let dir = upath.dirname(filePath);
  // Yield candidate pyproject.toml paths in strictly-ancestor directories.
  while (true) {
    const parent = upath.dirname(dir);
    if (parent === dir) {
      // Filesystem root; also check the localDir root candidate "pyproject.toml" if not already.
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

export interface WorkspaceRoot {
  rootPath: string;
  uv: UvConfig;
}

/**
 * Walk up from a member pyproject.toml path looking for an ancestor
 * pyproject.toml that declares `[tool.uv.workspace]` and lists the member.
 */
export async function findUvWorkspaceRoot(
  memberPackageFile: string,
): Promise<WorkspaceRoot | null> {
  let firstFound: WorkspaceRoot | null = null;
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
      // Treated as standalone for this candidate; keep walking.
      continue;
    }
    if (!matchesAny(memberRel, ws.members)) {
      continue;
    }
    if (firstFound) {
      // uv does not support nested workspaces; prefer the innermost one we
      // already found and just warn about the additional ancestor.
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
 * Merge a workspace root's uv config into a member's uv config, matching uv's
 * documented semantics:
 * - `tool.uv.sources`: member entries override root entries for the same key.
 * - `tool.uv.index`: union by name; member wins on name conflict. Indexes
 *   without a name are kept verbatim (they cannot conflict by name).
 */
export function mergeUvConfig(
  rootUv: UvConfig | undefined,
  memberUv: UvConfig | undefined,
): UvConfig | undefined {
  if (!rootUv && !memberUv) {
    return undefined;
  }
  if (!memberUv && !rootUv?.sources && !rootUv?.index) {
    return undefined;
  }

  const mergedSources =
    rootUv?.sources || memberUv?.sources
      ? { ...rootUv?.sources, ...memberUv?.sources }
      : undefined;

  let mergedIndex: UvConfig['index'];
  if (rootUv?.index || memberUv?.index) {
    const memberNames = new Set(
      (memberUv?.index ?? [])
        .map((i) => i.name)
        .filter((n): n is string => !!n),
    );
    mergedIndex = [
      ...(memberUv?.index ?? []),
      ...(rootUv?.index ?? []).filter(
        (i) => !i.name || !memberNames.has(i.name),
      ),
    ];
  }

  // Only sources and indexes are inherited from the workspace root. Other
  // fields (dev-dependencies, required-version, workspace) stay member-local.
  return {
    'dev-dependencies': memberUv?.['dev-dependencies'] ?? [],
    'required-version': memberUv?.['required-version'],
    sources: mergedSources,
    index: mergedIndex,
    workspace: memberUv?.workspace,
  };
}

/**
 * Convenience: load a member's pyproject's uv config merged with its
 * workspace root's, if any. Returns the member's uv config unchanged when
 * no workspace root is found.
 */
export async function getEffectiveUvConfig(
  memberUv: UvConfig | undefined,
  memberPackageFile: string | undefined,
): Promise<UvConfig | undefined> {
  if (!memberPackageFile) {
    return memberUv;
  }
  const root = await findUvWorkspaceRoot(memberPackageFile);
  if (!root) {
    return memberUv;
  }
  return mergeUvConfig(root.uv, memberUv);
}
