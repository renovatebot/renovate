import os from 'node:os';
import { isNonEmptyString } from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { readSystemFile } from '../../../util/fs/index.ts';
import type { GlobalManagerConfig } from '../types.ts';

export async function detectGlobalConfig(): Promise<GlobalManagerConfig> {
  const res: GlobalManagerConfig = {};
  const homedir = os.homedir();
  const candidatePaths: string[] = [];

  if (process.env.APPDATA) {
    candidatePaths.push(
      upath.join(process.env.APPDATA, 'NuGet', 'NuGet.Config'),
      upath.join(process.env.APPDATA, 'NuGet', 'nuget.config'),
    );
  }

  candidatePaths.push(
    upath.join(homedir, '.nuget', 'NuGet', 'NuGet.Config'),
    upath.join(homedir, '.config', 'NuGet', 'NuGet.Config'),
    upath.join(homedir, 'nuget.config'),
    upath.join(homedir, 'NuGet.config'),
    upath.join(homedir, 'NuGet.Config'),
    upath.join(homedir, '.nuget', 'nuget.config'),
    upath.join(homedir, '.nuget', 'NuGet.config'),
  );

  for (const candidatePath of candidatePaths) {
    try {
      const nugetConfig = await readSystemFile(candidatePath, 'utf8');
      if (isNonEmptyString(nugetConfig)) {
        res.nugetConfig = nugetConfig;
        res.nugetConfigMerge = true;
        logger.debug(
          `Detected ${candidatePath} and adding it to global config`,
        );
        break;
      }
    } catch {
      // ignore
    }
  }

  return res;
}
