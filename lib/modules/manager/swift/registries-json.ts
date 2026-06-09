import { z } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import { readLocalFile } from '../../../util/fs/index.ts';

// Subset of the SwiftPM `registries.json` schema we care about. Tolerates
// extra fields and unknown shapes — only the URL strings are needed.
const RegistriesJson = z.object({
  registries: z.record(z.string(), z.object({ url: z.string() })).optional(),
  version: z.number().optional(),
});

// SwiftPM's "[default]" key is the special unscoped registry.
const DEFAULT_KEY = '[default]';

export interface ParsedRegistries {
  defaultUrl?: string;
  named: Record<string, string>;
}

export function parseRegistriesJson(content: string): ParsedRegistries {
  const result: ParsedRegistries = { named: {} };
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch (err) {
    logger.debug({ err }, 'swift: failed to parse registries.json as JSON');
    return result;
  }

  const parsed = RegistriesJson.safeParse(raw);
  if (!parsed.success) {
    return result;
  }

  // Only `version: 1` is currently defined by SwiftPM. Treat anything else as
  // unrecognized rather than erroring out.
  if (parsed.data.version !== undefined && parsed.data.version !== 1) {
    logger.debug(
      { version: parsed.data.version },
      'swift: unrecognized registries.json version, ignoring',
    );
    return result;
  }

  for (const [key, value] of Object.entries(parsed.data.registries ?? {})) {
    if (key === DEFAULT_KEY) {
      result.defaultUrl = value.url;
    } else {
      result.named[key] = value.url;
    }
  }
  return result;
}

// Returns deduplicated registry URLs in priority order: the default registry
// first, then any named scope registries (alphabetical for stability).
//
// Both the project-local (`<dir>/.swiftpm/configuration/registries.json`) and
// any workspace-level locations (`<dir>/*.xcworkspace/xcshareddata/swiftpm/
// configuration/registries.json`) are considered. The manager iterates one
// Package.swift at a time so we only inspect files in or beside that file's
// directory.
export async function discoverRegistryUrls(
  packageSwiftPath: string,
): Promise<string[]> {
  const lastSlash = packageSwiftPath.lastIndexOf('/');
  const baseDir = lastSlash >= 0 ? packageSwiftPath.slice(0, lastSlash) : '';
  const candidate = baseDir
    ? `${baseDir}/.swiftpm/configuration/registries.json`
    : '.swiftpm/configuration/registries.json';

  const urls: string[] = [];
  const seen = new Set<string>();

  const collect = (parsed: ParsedRegistries): void => {
    const ordered = [
      parsed.defaultUrl,
      ...Object.keys(parsed.named)
        .sort()
        .map((k) => parsed.named[k]),
    ].filter((u): u is string => typeof u === 'string' && u.length > 0);
    for (const url of ordered) {
      if (!seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    }
  };

  const content = await readLocalFile(candidate, 'utf8');
  if (content) {
    collect(parseRegistriesJson(content));
  }

  return urls;
}
