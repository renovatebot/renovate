import { isPlainObject } from '@sindresorhus/is';
import { weave } from 'jsonc-weaver';
import { logger } from '../../../logger/index.ts';
import type { UpdateDependencyConfig } from '../types.ts';
import { findOverrideVersionField } from './schema.ts';

/**
 * Writes an update to the `version>=` of a dependency or the version of an
 * override.
 *
 * An override keeps its upstream version and its `port-version` in separate
 * fields, so `1.3.2#2` becomes `"version": "1.3.2"` and `"port-version": 2`,
 * and a new value without `#N` removes `port-version`. An entry that already
 * holds the new value leaves the file unchanged.
 */
export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const { depName, depType, currentValue, newValue } = upgrade;
  if (!depName || !depType || !currentValue || !newValue) {
    return null;
  }

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(fileContent);
  } catch (err) {
    logger.debug({ err }, 'vcpkg: failed to parse manifest for update');
    return null;
  }

  const entries = manifest[depType];
  if (!Array.isArray(entries)) {
    return null;
  }

  let isFound = false;
  let isChanged = false;
  for (const entry of entries) {
    if (!isPlainObject(entry) || entry.name !== depName) {
      continue;
    }

    if (depType === 'dependencies') {
      if (entry['version>='] === newValue) {
        isFound = true;
      } else if (entry['version>='] === currentValue) {
        entry['version>='] = newValue;
        isFound = true;
        isChanged = true;
      }
      continue;
    }

    const field = findOverrideVersionField(entry);
    if (!field) {
      continue;
    }
    const portVersion = entry['port-version'] ?? 0;
    const entryValue =
      portVersion === 0
        ? entry[field]
        : `${entry[field] as string}#${portVersion as number}`;
    if (entryValue === newValue) {
      isFound = true;
      continue;
    }
    if (entryValue !== currentValue) {
      continue;
    }

    const [version, newPortVersion] = newValue.split('#');
    entry[field] = version;
    if (newPortVersion && newPortVersion !== '0') {
      entry['port-version'] = parseInt(newPortVersion, 10);
    } else {
      delete entry['port-version'];
    }
    isFound = true;
    isChanged = true;
  }

  if (!isFound) {
    logger.debug({ depName, depType, currentValue }, 'vcpkg: entry not found');
    return null;
  }
  return isChanged ? weave(fileContent, manifest) : fileContent;
}
