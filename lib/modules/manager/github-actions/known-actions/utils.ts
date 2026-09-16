import { z } from 'zod/v4';
import { regEx } from '../../../../util/regex.ts';
import * as semverPartialVersioning from '../../../versioning/semver-partial/index.ts';
import { splitImageParts } from '../../dockerfile/extract.ts';
import type { PackageDependency } from '../../types.ts';
import type { ActionSchema, KnownActionConfig } from '../types.ts';

export function actionSchema(
  name: string,
  { withSchema, ...cfg }: KnownActionConfig,
): ActionSchema {
  return z
    .object({
      uses: matchAction(name),
      with: withSchema ?? VersionVal,
    })
    .transform(({ with: deps }) =>
      deps.map((dep) => {
        const merged = { ...cfg, ...dep };
        merged.depName ??= merged.packageName;
        return merged;
      }),
    );
}

export function matchAction(action: string): z.ZodString {
  return z
    .string()
    .regex(regEx(`(?:https?://[^/]+/)?${RegExp.escape(action)}(?:@.+)?$`));
}

export function parseValue(
  currentValue: string | undefined,
  isInvalid?: (val: string) => boolean,
): PackageDependency {
  if (!currentValue) {
    return {
      skipStage: 'extract',
      skipReason: 'unspecified-version',
      depType: 'uses-with',
    };
  }
  if (isInvalid?.(currentValue) === true) {
    return {
      skipStage: 'extract',
      skipReason: 'invalid-version',
      depType: 'uses-with',
      currentValue,
    };
  }
  return { currentValue, depType: 'uses-with' };
}

const partialVersionRegex = regEx(/^v?\d+(?:\.\d+)?$/);

/**
 * Whether the value is a whole major (`21`) or major.minor (`3.3`) version,
 * optionally `v`-prefixed (`v2.5`).
 */
export function isPartialVersion(value: string): boolean {
  return partialVersionRegex.test(value);
}

/**
 * As `parseValue`, for inputs where a partial version means "the latest
 * release of that line" rather than a pinned version.
 *
 * Renovate's default versionings treat a partial version as pinned, and so
 * replace it with a full-precision one (e.g. `3.3` -> `3.3.6`), which drops
 * the rolling behaviour the workflow asked for. `semver-partial` versioning
 * keeps the value's precision instead (`3.3` -> `3.4`).
 */
export function parsePartialValue(
  currentValue: string | undefined,
  isInvalid?: (val: string) => boolean,
): PackageDependency {
  const dep = parseValue(currentValue, isInvalid);
  if (currentValue && !dep.skipReason && isPartialVersion(currentValue)) {
    dep.versioning = semverPartialVersioning.id;
  }
  return dep;
}

/**
 * A single dependency, versioned by the given `with:` input.
 *
 * @param isInvalid should return `true` if the version is invalid and should be skipped
 */
export function valSchema(
  key: string,
  isInvalid?: (val: string) => boolean,
): ActionSchema {
  return z
    .object({ [key]: z.string().optional() })
    .transform((val) => [parseValue(val[key], isInvalid)]);
}

/**
 * As `valSchema`, for inputs which accept a partial version.
 */
export function partialValSchema(
  key: string,
  isInvalid?: (val: string) => boolean,
): ActionSchema {
  return z
    .object({ [key]: z.string().optional() })
    .transform((val) => [parsePartialValue(val[key], isInvalid)]);
}

export const VersionVal = valSchema('version');

export function parseImageValue(image: string | undefined): PackageDependency {
  if (!image) {
    return {
      depType: 'uses-with',
      skipStage: 'extract',
      skipReason: 'unspecified-version',
    };
  }

  const dep = splitImageParts(image);
  return {
    depType: 'uses-with',
    ...dep,
    ...(dep.skipReason ? { skipStage: 'extract' } : {}),
  };
}

// Shared by the `actions/setup-{go,node,python}` entries below, whose
// releases are published as `actions/{go,node,python}-versions` GitHub
// releases, tagged like `20.11.0` or `20.11.0-1` (a build number suffix).
export const actionsVersionsExtractVersion =
  '^(?<version>\\d+\\.\\d+\\.\\d+)(-\\d+)?$';
