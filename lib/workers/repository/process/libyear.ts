import { DateTime } from 'luxon';
import { logger } from '../../../logger';
import type { PackageFile } from '../../../modules/manager/types';

export function calculateLibYears(
  packageFiles?: Record<string, PackageFile[]>,
): void {
  if (!packageFiles) {
    return;
  }
  const managerLibYears: Record<string, number> = {};
  for (const [manager, files] of Object.entries(packageFiles)) {
    for (const file of files) {
      let fileLibYears = 0;
      for (const dep of file.deps) {
        if (dep.updates?.length) {
          for (const update of dep.updates) {
            if (update.releaseTimestamp) {
              if (dep.currentVersionTimestamp) {
                // timestamps are in ISO format
                const currentVersionDate = DateTime.fromISO(
                  dep.currentVersionTimestamp,
                );
                const releaseDate = DateTime.fromISO(update.releaseTimestamp);
                const libYears = releaseDate.diff(
                  currentVersionDate,
                  'years',
                ).years;
                if (libYears >= 0) {
                  update.libYears = libYears;
                }
              } else {
                logger.debug(`No currentVersionTimestamp for ${dep.depName}`);
              }
            } else {
              logger.debug(
                `No releaseTimestamp for ${dep.depName} update to ${update.newVersion}`,
              );
            }
          }
          // Set the highest libYears for the dep
          const depLibYears = Math.max(
            ...(dep.updates ?? []).map((update) => update.libYears ?? 0),
            0,
          );
          fileLibYears += depLibYears;
        }
      }
      managerLibYears[manager] ??= 0;
      managerLibYears[manager] += fileLibYears;
    }
  }
  // Sum up the libYears for the repo
  const totalLibYears = Object.values(managerLibYears).reduce(
    (acc, libYears) => acc + libYears,
    0,
  );
  logger.debug({ managerLibYears, totalLibYears }, 'Repository libYears');
}
