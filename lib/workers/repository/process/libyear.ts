import { DateTime } from 'luxon';
import type { RenovateConfig } from '../../../config/types';
import { addLibYears } from '../../../instrumentation/reporting';
import type { LibYearsWithStatus } from '../../../instrumentation/types';
import { logger } from '../../../logger';
import type { PackageFile } from '../../../modules/manager/types';

interface DepInfo {
  depName: string;
  manager: string;
  datasource: string;
  version: string;
  file: string;
  outdated?: boolean;
  libYear?: number;
}

export function calculateLibYears(
  config: RenovateConfig,
  packageFiles?: Record<string, PackageFile[]>,
): void {
  if (!packageFiles) {
    return;
  }
  const allDeps: DepInfo[] = [];
  for (const [manager, files] of Object.entries(packageFiles)) {
    for (const file of files) {
      for (const dep of file.deps) {
        const depInfo: DepInfo = {
          depName: dep.depName!,
          manager,
          file: file.packageFile,
          datasource: dep.datasource!,
          version: (dep.currentVersion ?? dep.currentValue)!,
        };

        if (!dep.updates?.length) {
          allDeps.push(depInfo);
          continue;
        }

        depInfo.outdated = true;
        if (!dep.currentVersionTimestamp) {
          logger.once.debug(`No currentVersionTimestamp for ${dep.depName}`);
          allDeps.push(depInfo);
          continue;
        }
        // timestamps are in ISO format
        const currentVersionDate = DateTime.fromISO(
          dep.currentVersionTimestamp,
        );

        for (const update of dep.updates) {
          if (!update.releaseTimestamp) {
            logger.once.debug(
              `No releaseTimestamp for ${dep.depName} update to ${update.newVersion}`,
            );
            continue;
          }
          const releaseDate = DateTime.fromISO(update.releaseTimestamp);
          const libYears = releaseDate.diff(currentVersionDate, 'years').years;
          if (libYears >= 0) {
            update.libYears = libYears;
          }
        }
        // Set the highest libYears for the dep
        const depLibYears = Math.max(
          ...dep.updates.map((update) => update.libYears ?? 0),
          0,
        );
        depInfo.libYear = depLibYears;
        allDeps.push(depInfo);
      }
    }
  }
  const libYearsWithStatus = getLibYears(allDeps);
  logger.debug(libYearsWithStatus, 'Repository libYears');

  addLibYears(config, libYearsWithStatus);
}

function getLibYears(allDeps: DepInfo[]): LibYearsWithStatus {
  const [totalDepsCount, outdatedDepsCount, totalLibYears] = getCounts(allDeps);
  const managerLibYears = getManagerLibYears(allDeps);

  return {
    libYears: {
      managers: managerLibYears,
      total: totalLibYears,
    },
    dependencyStatus: {
      outdated: outdatedDepsCount,
      total: totalDepsCount,
    },
  };
}

function getManagerLibYears(deps: DepInfo[]): Record<string, number> {
  /** {manager : {depKey: libYear }} */
  const managerLibYears: Record<string, Record<string, number>> = {};
  for (const dep of deps) {
    const depKey = `${dep.depName}@${dep.version}@${dep.datasource}`;
    const manager = dep.manager;
    managerLibYears[manager] ??= {};
    if (dep.libYear) {
      if (!managerLibYears[manager][depKey]) {
        managerLibYears[manager][depKey] = dep.libYear;
      }
    }
  }

  const res: Record<string, number> = {};
  for (const [manager, deps] of Object.entries(managerLibYears)) {
    const managerLibYear = Object.values(deps).reduce((sum, curr) => {
      return sum + curr;
    }, 0);
    res[manager] = managerLibYear;
  }

  return res;
}

function getCounts(deps: DepInfo[]): [number, number, number] {
  const distinctDeps = new Set<string>();
  let totalDepsCount = 0,
    outdatedDepsCount = 0,
    totalLibYears = 0;
  for (const dep of deps) {
    const depKey = `${dep.depName}@${dep.version}@${dep.datasource}`;
    if (!distinctDeps.has(depKey)) {
      if (dep.outdated) {
        outdatedDepsCount++;
      }
      if (dep.libYear) {
        totalLibYears += dep.libYear;
      }

      totalDepsCount++;
      distinctDeps.add(depKey);
    }
  }

  return [totalDepsCount, outdatedDepsCount, totalLibYears];
}
