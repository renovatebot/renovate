import { regEx } from '../../../util/regex.ts';
import type { JsDelivrParsedPackageName } from './types.ts';

/**
 * Handles package names for both npm (scoped and unscoped) and gh.
 *
 * npm:
 *   - scoped: https://data.jsdelivr.com/v1/packages/npm/@popperjs/core
 *   - unscoped: https://data.jsdelivr.com/v1/packages/npm/jquery
 * gh:
 *   - https://data.jsdelivr.com/v1/packages/gh/twbs/bootstrap
 *
 * @param packageName
 * @returns
 */

export function parseJsDelivrPackageName(
  packageName: string,
): JsDelivrParsedPackageName {
  const parts = packageName.split('/');

  // Extract type.
  const packageType = parts[0];
  parts.shift();

  // strip version tags.
  const sanitizedParts = parts.map((part) =>
    part.replace(regEx(/@\d+(?:\.\d+)*$/), '').trim(),
  );

  // gh/{user}/{repository}
  if (packageType === 'gh') {
    // {user}/{repository}
    const depNameParts = sanitizedParts.splice(0, 2);

    return {
      type: 'gh',
      package: depNameParts.join('/'),
      asset: sanitizedParts.join('/'),
    };
  }

  // npm/@{scope}/{package} | npm/{package}
  if (packageType === 'npm') {
    // Handle scope / unscoped packages.
    const depNameParts = sanitizedParts[0].startsWith('@')
      ? sanitizedParts.splice(0, 2)
      : sanitizedParts.splice(0, 1);
    return {
      type: 'npm',
      package: depNameParts.join('/'),
      asset: sanitizedParts.join('/'),
    };
  }

  throw new Error(
    `Unknown package type: ${packageType} (possible values: 'npm', 'gh')`,
  );
}
