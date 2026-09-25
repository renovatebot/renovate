import is from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import {
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import type { KasConfig } from './schema.ts';
import { KasConfigJson, KasConfigYaml } from './schema.ts';
import type { KasConfigFile, KasConfigTree } from './types.ts';

export function isLockFilePath(filePath: string): boolean {
  return regEx(/\.lock\.(?<ext>yml|yaml|json)$/i).test(filePath);
}

export function isYamlFilePath(filePath: string): boolean {
  return regEx(/\.(?<ext>yml|yaml)$/i).test(filePath);
}

export function getLockFilePath(filePath: string): string | null {
  if (isLockFilePath(filePath)) {
    return null;
  }
  const lockFilePath = filePath.replace(
    regEx(/\.(?<ext>yml|yaml|json)$/i),
    '.lock.$<ext>',
  );
  return lockFilePath === filePath ? null : lockFilePath;
}

export function parseKasConfig(path: string, content: string): KasConfig {
  return (isYamlFilePath(path) ? KasConfigYaml : KasConfigJson).parse(content);
}

function deepMerge(
  dest: Record<string, unknown>,
  upd: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...dest };
  for (const [key, val] of Object.entries(upd)) {
    const cur = out[key];
    out[key] =
      is.plainObject(cur) && is.plainObject(val) ? deepMerge(cur, val) : val;
  }
  return out;
}

/** Port of kas `IncludeHandler._internal_dict_merge`: later files win. */
export function mergeConfigs(files: KasConfigFile[]): KasConfig {
  return files
    .map((f) => f.config as Record<string, unknown>)
    .reduce(deepMerge) as KasConfig;
}

class IncludeError extends Error {}

/**
 * Port of kas `IncludeHandler.get_config` for a single top file.
 * Like kas, a file included twice is merged twice (position matters), and a
 * missing local include is an error. Cross-repo includes (`{repo, file}`)
 * are skipped as their repos are not checked out; `hasCrossRepoIncludes`
 * tells callers the merged view is incomplete.
 */
export async function loadKasConfigTree(
  rootFile: string,
): Promise<KasConfigTree | null> {
  const files: KasConfigFile[] = [];
  const ancestors: string[] = [];
  let hasCrossRepoIncludes = false;

  async function visit(path: string, isLockFile: boolean): Promise<void> {
    if (ancestors.includes(path)) {
      throw new IncludeError(`include cycle: ${ancestors.join(' -> ')}`);
    }
    const content = await readLocalFile(path, 'utf8');
    if (!content) {
      if (isLockFile) {
        return;
      }
      throw new IncludeError(`kas config file missing or empty: ${path}`);
    }
    const config = parseKasConfig(path, content);
    ancestors.push(path);
    const lock = isLockFile ? null : getLockFilePath(path);
    if (lock) {
      await visit(lock, true);
    }
    for (const include of coerceArray(config.header.includes)) {
      if (!is.string(include)) {
        logger.debug(
          { path, include },
          'kas cross-repo include not supported, skipping',
        );
        hasCrossRepoIncludes = true;
        continue;
      }
      // kas resolves repo-relative first, then falls back to file-relative
      let target = upath.normalize(include);
      if (!(await localPathExists(target))) {
        const alt = getSiblingFileName(path, include);
        if (await localPathExists(alt)) {
          logger.debug({ path, include }, 'kas include resolved file-relative');
          target = alt;
        }
      }
      await visit(target, false);
    }
    ancestors.pop();
    files.push({ path, isLockFile, content, config });
  }

  try {
    await visit(rootFile, false);
  } catch (err) {
    logger.warn({ rootFile, err }, 'Loading KAS config failed');
    return null;
  }
  return {
    files,
    merged: mergeConfigs(files),
    mergedNoLock: mergeConfigs(files.filter((f) => !f.isLockFile)),
    hasCrossRepoIncludes,
  };
}
