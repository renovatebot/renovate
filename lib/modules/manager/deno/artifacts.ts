import { isEmptyArray } from '@sindresorhus/is';
import upath from 'upath';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import {
  deleteLocalFile,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { processHostRules } from '../npm/post-update/rules.ts';
import {
  getNpmrcContent,
  resetNpmrcContent,
  updateNpmrcContent,
} from '../npm/utils.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import type { DenoManagerData } from './types.ts';

export async function updateArtifacts(
  updateArtifact: UpdateArtifact<DenoManagerData>,
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName, updatedDeps, newPackageFileContent, config } =
    updateArtifact;
  logger.debug(`deno.updateArtifacts(${packageFileName})`);
  const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';

  if (isEmptyArray(updatedDeps) && !isLockFileMaintenance) {
    logger.debug('No updated deno deps - returning null');
    return null;
  }

  // falling back for lockFileMaintenance
  const lockFileName = updatedDeps[0]?.lockFiles?.[0] ?? config.lockFiles?.[0];

  if (!lockFileName) {
    logger.debug('No lock file found. Skipping artifact update.');
    return null;
  }

  const oldLockFileContent = await readLocalFile(lockFileName);
  if (!oldLockFileContent) {
    logger.debug(`Failed to read ${lockFileName}. Skipping artifact update.`);
    return [
      {
        artifactError: {
          fileName: lockFileName,
          stderr: `Failed to read "${lockFileName}"`,
        },
      },
    ];
  }

  for (const updateDep of updatedDeps) {
    if (
      updateDep.depType === 'tasks' ||
      updateDep.depType === 'tasks.command'
    ) {
      logger.warn(
        `depType: "${updateDep.depType}", depName: "${updateDep.depName}" can't be updated with a lock file: "${lockFileName}"`,
      );
      return [
        {
          artifactError: {
            fileName: lockFileName,
            stderr: `depType: "${updateDep.depType}", depName: "${updateDep.depName}" can't be updated with a lock file: "${lockFileName}"`,
          },
        },
      ];
    }
  }

  const pkgFileDir = upath.dirname(packageFileName);
  const { additionalNpmrcContent } = processHostRules();
  const npmrcContent = await getNpmrcContent(pkgFileDir);
  await updateNpmrcContent(pkgFileDir, npmrcContent, additionalNpmrcContent);

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);

    let args = '';
    if (isLockFileMaintenance) {
      await deleteLocalFile(lockFileName);
      // force update lockfile when deleting it
      // https://github.com/denoland/deno/blob/7eda90e61d107a2f48ef6eab954cda143707e01c/tests/specs/lockfile/frozen_lockfile/no_lockfile_run.out
      args += ' --frozen=false';
    }

    // run from its referred deno.json/deno.jsonc location if import map is used
    const importMapReferrerDep = updatedDeps.find(
      (dep) => dep.managerData?.importMapReferrer,
    );
    const cwdFile =
      importMapReferrerDep?.managerData?.importMapReferrer ?? packageFileName;

    const execOptions: ExecOptions = {
      cwdFile,
      docker: {},
      toolConstraints: [
        {
          toolName: 'deno',
          constraint: config.constraints?.deno,
        },
      ],
    };

    // defaults as per https://docs.deno.com/runtime/fundamentals/security/#importing-from-the-web
    const defaultImportHosts = [
      'deno.land:443',
      'esm.sh:443',
      'jsr.io:443',
      'cdn.jsdelivr.net:443',
      'raw.githubusercontent.com:443',
      'gist.githubusercontent.com:443',
    ];
    const additionalImportHosts = hostRules
      .findAll({ hostType: 'npm' })
      .filter((rule) => rule.resolvedHost)
      .map((rule) => rule.resolvedHost);

    if (additionalImportHosts.length > 0) {
      // combine default and additional import hosts, removing duplicates
      const importHosts = [
        ...new Set([...defaultImportHosts, ...additionalImportHosts]),
      ].join(',');

      args += ` --allow-import=${importHosts}`;
    }

    // "deno install" don't execute lifecycle scripts of package.json by default
    // https://docs.deno.com/runtime/reference/cli/install/#native-node.js-addons
    // TODO: appending `--lockfile-only` is better to reduce disk usage
    // https://docs.deno.com/runtime/reference/cli/install/#options-lockfile-only
    let command = 'deno install';
    if (args) {
      command += args;
    }
    await exec(command, execOptions);
    await resetNpmrcContent(pkgFileDir, npmrcContent);

    const newLockFileContent = await readLocalFile(lockFileName);
    if (
      !newLockFileContent ||
      Buffer.compare(oldLockFileContent, newLockFileContent) === 0
    ) {
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
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.warn({ lockfile: lockFileName, err }, `Failed to update lock file`);
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
