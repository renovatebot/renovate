import { isObject } from '@sindresorhus/is';
import { z } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import { getSiblingFileName, readLocalFile } from '../../../util/fs/index.ts';
import { Http } from '../../../util/http/index.ts';
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

interface LockfileFormat {
  packages?: Record<string, { url?: string }>;
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

  // Special-case Nim compiler
  if (lowerName === 'nim') {
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

  // Tier 1: Companion lockfiles (nimble.lock, atlas.lock)
  if (packageFile) {
    for (const lockFileName of ['nimble.lock', 'atlas.lock']) {
      try {
        const lockPath = getSiblingFileName(packageFile, lockFileName);
        const content = await readLocalFile(lockPath, 'utf8');
        if (content) {
          const parsed = JSON.parse(content) as unknown;
          if (
            isObject(parsed) &&
            isObject((parsed as LockfileFormat).packages)
          ) {
            const packages = (parsed as LockfileFormat).packages!;
            for (const [pkgKey, pkgVal] of Object.entries(packages)) {
              if (pkgKey.toLowerCase() === lowerName && pkgVal?.url) {
                return pkgVal.url;
              }
            }
          }
        }
      } catch (err) {
        logger.trace(
          { err, lockFileName },
          'Error checking companion lockfile for package url',
        );
      }
    }
  }

  // Tier 2: Upstream registry
  const registry = await getNimbleRegistry();
  const url = registry.get(lowerName);
  if (url) {
    return url;
  }

  // Tier 3: Unknown / fallback
  return undefined;
}
