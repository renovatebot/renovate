import { logger } from '../../../../logger/index.ts';
import type { Upgrade } from '../../types.ts';
import { packageLockTransitive } from '../dep-types.ts';
import { getLockedPackages } from '../extract/post/transitive.ts';
import { PackageLockPackages } from '../schema.ts';

export function isTransitiveUpdate(upgrade: Upgrade): boolean {
  return upgrade.depType === packageLockTransitive;
}

function formatList(items: string[]): string {
  const quoted = items.map((item) => `\`${item}\``);
  if (quoted.length === 1) {
    return quoted[0];
  }
  return `${quoted.slice(0, -1).join(', ')} and ${quoted.at(-1)!}`;
}

/**
 * `npm update` takes no version, so it updates a transitive dependency to the
 * newest version the packages which depend on it allow - which may not be the
 * version the update was planned for, or may leave it where it was.
 *
 * Returns a notice saying what the lock file holds after the update, where
 * that differs from the plan, or `null` when it does not.
 */
export function getTransitiveUpdateNotice(
  lockFileContent: string,
  transitiveUpdates: Upgrade[],
): string | null {
  const parsed = PackageLockPackages.safeParse(lockFileContent);
  // v8 ignore if -- only lock files with `packages` have transitive updates
  if (!parsed.success) {
    return null;
  }
  const locked = getLockedPackages(parsed.data);

  const lines: string[] = [];
  const names = [...new Set(transitiveUpdates.map((u) => u.depName!))];
  for (const name of names) {
    const updates = transitiveUpdates.filter((u) => u.depName === name);
    const lockedVersions = locked
      .filter((pkg) => pkg.name === name)
      .map((pkg) => pkg.version);
    if (!lockedVersions.length) {
      lines.push(`- \`${name}\` is no longer in the lock file.`);
      continue;
    }

    const notUpdated = updates
      .map((u) => u.currentVersion!)
      .filter((version) => lockedVersions.includes(version));
    if (notUpdated.length) {
      lines.push(
        `- ${formatList(notUpdated.map((v) => `${name}@${v}`))} could not be updated, because the packages which depend on it do not allow a newer version.`,
      );
    }

    const planned = updates.map((u) => u.newVersion!);
    const updated = lockedVersions.filter(
      (version) => !notUpdated.includes(version),
    );
    if (updated.some((version) => !planned.includes(version))) {
      lines.push(
        `- \`${name}\` is now locked at ${formatList(updated)}, the newest versions the packages which depend on it allow.`,
      );
    }
  }

  if (!lines.length) {
    return null;
  }

  logger.debug({ lines }, 'npm: transitive update differs from the plan');
  return [
    'Transitive dependencies are updated with `npm update`, within the ranges the packages which depend on them allow:',
    '',
    ...lines,
  ].join('\n');
}
