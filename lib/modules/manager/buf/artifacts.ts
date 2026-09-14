import { isEmptyArray } from '@sindresorhus/is';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import {
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { parseUrl } from '../../../util/url.ts';
import { BufModuleDatasource } from '../../datasource/buf-module/index.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';

/**
 * Build a `BUF_TOKEN` value from any configured `buf-module` host rules.
 *
 * `buf` reads a single token, or a comma-separated `token@remote` list for
 * multiple registries — see https://buf.build/docs/bsr/authentication.
 */
function getBufToken(registryUrls: string[]): string | undefined {
  const parts: string[] = [];
  for (const registryUrl of registryUrls) {
    const { token } = hostRules.find({
      hostType: BufModuleDatasource.id,
      url: registryUrl,
    });
    const host = parseUrl(registryUrl)?.host;
    if (token && host) {
      parts.push(`${token}@${host}`);
    }
  }
  return parts.length ? parts.join(',') : undefined;
}

export async function updateArtifacts(
  updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName, updatedDeps, newPackageFileContent, config } =
    updateArtifact;
  logger.debug(`buf.updateArtifacts(${packageFileName})`);

  if (isEmptyArray(updatedDeps) && !config.isLockFileMaintenance) {
    logger.debug('buf: no updated deps - returning null');
    return null;
  }

  const lockFileName =
    updatedDeps[0]?.lockFiles?.[0] ??
    config.lockFiles?.[0] ??
    getSiblingFileName(packageFileName, 'buf.lock');

  const oldLockFileContent = await readLocalFile(lockFileName);
  if (!oldLockFileContent) {
    logger.debug(`buf: no ${lockFileName} found - skipping artifact update`);
    return null;
  }

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);

    const registryUrls = [
      ...new Set(updatedDeps.flatMap((dep) => coerceArray(dep.registryUrls))),
    ];
    const bufToken = getBufToken(registryUrls);

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      docker: {},
      toolConstraints: [
        { toolName: 'buf', constraint: config.constraints?.buf },
      ],
      extraEnv: bufToken ? { BUF_TOKEN: bufToken } : undefined,
    };

    await exec('buf dep update', execOptions);

    const newLockFileContent = await readLocalFile(lockFileName);
    if (
      !newLockFileContent ||
      oldLockFileContent.toString() === newLockFileContent.toString()
    ) {
      logger.debug('buf: lock file is unchanged');
      return null;
    }

    return [
      {
        file: {
          type: 'addition',
          path: lockFileName,
          contents: newLockFileContent,
        },
      },
    ];
  } catch (err) {
    /* v8 ignore next -- exec-layer TEMPORARY_ERROR passthrough */
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, 'buf: failed to update buf.lock');
    return [
      {
        artifactError: {
          fileName: lockFileName,
          stderr: err.message,
        },
      },
    ];
  }
}
