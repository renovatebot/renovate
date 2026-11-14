import { isNonEmptyString, isPlainObject } from '@sindresorhus/is';
import upath from 'upath';
import { z } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { Http } from '../../../util/http/index.ts';
import { regEx } from '../../../util/regex.ts';
import type { NimblePackageEntry } from './types.ts';

export const NIMBLE_PACKAGES_URL =
  'https://raw.githubusercontent.com/nim-lang/packages/master/packages.json';

export const CACHE_NAMESPACE = 'datasource-nimble-packages';
export const CACHE_KEY = 'packages.json';
export const CACHE_TTL_MINUTES = 24 * 60; // 24 hours

export const NimblePackage = z
  .object({
    name: z.string().optional(),
    url: z.string().optional(),
    alias: z.string().optional(),
  })
  .passthrough();

export const NimblePackages = z.array(NimblePackage);

const http = new Http('nimble');

/**
 * Expands Nimble forge aliases according to `nimblepkg/forge_aliases.nim`:
 * - `github:user/repo`, `gh:user/repo` -> `https://github.com/user/repo`
 * - `gitlab:user/repo`, `gl:user/repo` -> `https://gitlab.com/user/repo`
 * - `sourcehut:user/repo`, `srht:user/repo`, `shart:user/repo` -> `https://git.sr.ht/~user/repo`
 * - `codeberg:user/repo`, `cb:user/repo`, `cberg:user/repo` -> `https://codeberg.org/user/repo`
 */
export function expandForgeAlias(name: string): string | undefined {
  const parts = name.split(':');
  if (parts.length !== 2 || name.includes('://')) {
    return undefined;
  }

  const forge = parts[0].toLowerCase();
  const repoPart = parts[1].replace(regEx('\\.git$'), '');
  const subParts = repoPart.split('/');
  if (subParts.length < 2) {
    return undefined;
  }

  let username = subParts[0];
  const repository = subParts.slice(1).join('/');
  if (!username || !repository) {
    return undefined;
  }

  switch (forge) {
    case 'github':
    case 'gh':
      return `https://github.com/${username}/${repository}`;
    case 'gitlab':
    case 'gl':
      return `https://gitlab.com/${username}/${repository}`;
    case 'codeberg':
    case 'cb':
    case 'cberg':
      return `https://codeberg.org/${username}/${repository}`;
    case 'sourcehut':
    case 'srht':
    case 'shart': {
      if (!username.startsWith('~')) {
        username = `~${username}`;
      }
      return `https://git.sr.ht/${username}/${repository}`;
    }
    default:
      return undefined;
  }
}

export function extractLockfileUrls(content: string): Map<string, string> {
  const map = new Map<string, string>();
  try {
    const parsed: unknown = JSON.parse(content);
    if (!isPlainObject(parsed)) {
      return map;
    }

    function addEntries(obj: Record<string, unknown>): void {
      for (const [key, val] of Object.entries(obj)) {
        if (isPlainObject(val) && isNonEmptyString(val.url)) {
          map.set(key.toLowerCase(), val.url);
        }
      }
    }

    // nimble.lock v1/v2 top-level packages
    if (isPlainObject(parsed.packages)) {
      addEntries(parsed.packages);
    }

    // nimble.lock v2 task-specific packages
    if (isPlainObject(parsed.tasks)) {
      for (const taskDeps of Object.values(parsed.tasks)) {
        if (isPlainObject(taskDeps)) {
          addEntries(taskDeps);
        }
      }
    }

    // atlas.lock items
    if (isPlainObject(parsed.items)) {
      addEntries(parsed.items);
    }
  } catch (err) {
    logger.trace({ err }, 'Failed to parse nimble/atlas lockfile');
  }
  return map;
}

export async function getLockfileRegistry(
  packageFile?: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!packageFile) {
    return map;
  }

  const dir = upath.dirname(packageFile);
  const lockFiles = ['nimble.lock', 'atlas.lock'];

  for (const lockName of lockFiles) {
    const lockPath = dir === '.' ? lockName : upath.join(dir, lockName);
    try {
      const content = await readLocalFile(lockPath, 'utf8');
      if (content) {
        const extracted = extractLockfileUrls(content);
        for (const [k, v] of extracted.entries()) {
          if (!map.has(k)) {
            map.set(k, v);
          }
        }
      }
    } catch (err) {
      logger.trace({ err, lockPath }, 'Failed to read companion lockfile');
    }
  }

  return map;
}

export function parseNimbleRegistry(
  entries: NimblePackageEntry[],
): Map<string, string> {
  const map = new Map<string, string>();
  const aliases = new Map<string, string>();

  for (const entry of entries) {
    if (!entry.name) {
      continue;
    }
    const lowerName = entry.name.toLowerCase();
    if (entry.alias) {
      aliases.set(lowerName, entry.alias.toLowerCase());
    } else if (entry.url) {
      map.set(lowerName, entry.url);
    }
  }

  // Resolve aliases with circular redirect protection (max depth 3)
  for (const [aliasName, targetName] of aliases.entries()) {
    let current = targetName;
    let depth = 0;
    const visited = new Set<string>([aliasName]);

    while (depth < 3 && aliases.has(current) && !map.has(current)) {
      if (visited.has(current)) {
        break;
      }
      visited.add(current);
      current = aliases.get(current)!;
      depth++;
    }

    const resolvedUrl = map.get(current);
    if (resolvedUrl) {
      map.set(aliasName, resolvedUrl);
    }
  }

  return map;
}

export async function getNimbleRegistry(): Promise<Map<string, string>> {
  try {
    const cached = await packageCache.get<Record<string, string>>(
      CACHE_NAMESPACE,
      CACHE_KEY,
    );
    if (cached) {
      return new Map(Object.entries(cached));
    }
  } catch (err) {
    logger.trace({ err }, 'Failed to get nimble packages from cache');
  }

  try {
    const res = await http.getJson(NIMBLE_PACKAGES_URL, NimblePackages);
    const map = parseNimbleRegistry(res.body);
    try {
      const record: Record<string, string> = Object.fromEntries(map.entries());
      await packageCache.set(
        CACHE_NAMESPACE,
        CACHE_KEY,
        record,
        CACHE_TTL_MINUTES,
      );
    } catch (err) {
      logger.trace({ err }, 'Failed to cache nimble packages');
    }
    return map;
  } catch (err) {
    logger.debug({ err }, 'Failed to fetch nimble packages registry');
  }

  return new Map<string, string>();
}

export async function resolvePackageUrl(
  depName: string,
  packageFile?: string,
): Promise<string | undefined> {
  const trimmed = depName.trim();
  if (!trimmed) {
    return undefined;
  }

  const lowerName = trimmed.toLowerCase();

  // Special-case Nim compiler and aliases
  if (
    lowerName === 'nim' ||
    lowerName === 'nimrod' ||
    lowerName === 'compiler'
  ) {
    return 'https://github.com/nim-lang/Nim';
  }

  // Already a direct URL or git address
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('git@')
  ) {
    return trimmed;
  }

  // Forge alias (github:owner/repo, gh:owner/repo, gitlab:owner/repo, etc.)
  const expandedForge = expandForgeAlias(trimmed);
  if (expandedForge) {
    return expandedForge;
  }

  // Tier 1: Companion lockfile (nimble.lock or atlas.lock)
  const lockMap = await getLockfileRegistry(packageFile);
  const lockUrl = lockMap.get(lowerName);
  if (lockUrl) {
    return lockUrl;
  }

  // Tier 2: Official Nimble packages.json registry
  const registry = await getNimbleRegistry();
  const url = registry.get(lowerName);
  if (url) {
    return url;
  }

  return undefined;
}
