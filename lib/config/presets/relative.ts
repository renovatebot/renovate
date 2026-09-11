import { isArray, isPlainObject, isString } from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../logger/index.ts';
import { coerceString } from '../../util/string.ts';
import { isRelativePresetReference, parsePreset } from './parse.ts';
import type { ParsedPreset } from './types.ts';
import { PRESET_RELATIVE_OUTSIDE_REPO } from './util.ts';

/**
 * Keys whose array entries may contain relative preset references.
 */
const presetReferenceKeys = ['extends', 'ignorePresets'];

/**
 * Converts a relative preset reference into an absolute preset string, by
 * inheriting the source, repository and tag of the preset which references it.
 *
 * For example `./system/registries` found inside `github>some/repo#v2.0.0`
 * resolves to `github>some/repo//system/registries#v2.0.0`.
 */
function resolveRelativePreset(input: string, parent: ParsedPreset): string {
  const parsed = parsePreset(input);

  let resolved: string;
  if (parsed.presetName.startsWith('/')) {
    // relative to the root of the repository
    resolved = upath.normalize(parsed.presetName.slice(1));
  } else {
    // relative to the directory of the preset file which references it
    resolved = upath.normalize(
      upath.join(coerceString(parent.presetPath), parsed.presetName),
    );
  }

  if (resolved === '..' || resolved.startsWith('../')) {
    throw new Error(PRESET_RELATIVE_OUTSIDE_REPO);
  }

  const tag = parent.tag ? `#${parent.tag}` : '';
  const params = isString(parsed.rawParams) ? `(${parsed.rawParams})` : '';

  if (resolved === 'default') {
    // the default preset at the root of the repository is spelled without a
    // path, so emitting `//default` here would break deduplication against the
    // way consumers reference the very same preset
    return `${parent.presetSource}>${parent.repo}${tag}${params}`;
  }

  return `${parent.presetSource}>${parent.repo}//${resolved}${tag}${params}`;
}

/**
 * Rewrites every relative preset reference found in any `extends` or
 * `ignorePresets` array of the given value into an absolute preset string.
 * The value is mutated in place.
 */
export function canonicalizeRelativePresets(
  value: unknown,
  parent: ParsedPreset,
): void {
  if (isArray(value)) {
    for (const element of value) {
      canonicalizeRelativePresets(element, parent);
    }
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, val] of Object.entries(value)) {
    if (presetReferenceKeys.includes(key) && isArray(val)) {
      value[key] = val.map((entry) => rewritePresetEntry(entry, parent));
      continue;
    }

    canonicalizeRelativePresets(val, parent);
  }
}

function rewritePresetEntry(entry: unknown, parent: ParsedPreset): unknown {
  if (!isString(entry) || !isRelativePresetReference(entry)) {
    return entry;
  }

  // only the path may not be templated, because it has to be resolved here,
  // while the parameters are compiled later on
  const pathPortion = entry.includes('(')
    ? entry.slice(0, entry.indexOf('('))
    : entry;
  if (pathPortion.includes('{{')) {
    return entry;
  }

  try {
    return resolveRelativePreset(entry, parent);
  } catch (err) {
    // the unchanged entry is reported when it is resolved as a preset, which
    // allows consumers to neutralize it using `ignorePresets`
    logger.warn(
      { preset: entry, parentPreset: parent, err },
      'Could not resolve relative preset reference',
    );
    return entry;
  }
}
