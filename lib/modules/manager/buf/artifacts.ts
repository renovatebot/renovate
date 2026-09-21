import { isEmptyArray } from '@sindresorhus/is';
import upath from 'upath';
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
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
} from '../types.ts';
import { resolveToolConstraint } from '../util.ts';

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

/**
 * Advance any commit pins in the sibling `buf.yaml` to the updated commits.
 *
 * A `buf.yaml` dep pinned to a specific commit (`buf.build/owner/repo:<commit>`)
 * is the source of truth `buf dep update` re-resolves from, so bumping only
 * `buf.lock` is reverted on the next `buf dep update`. Rewriting the pin here,
 * before `buf dep update` runs, lets the new commit stick; `buf.lock`'s commit
 * and `b5:` digest are then regenerated to match.
 *
 * Only deps carrying both `currentDigest` and `newDigest` (an actual digest
 * update) are considered, and unpinned deps simply won't match, so this is a
 * no-op unless a real commit pin is present.
 */
async function advanceBufYamlPins(
  packageFileName: string,
  updatedDeps: PackageDependency[],
): Promise<UpdateArtifactsResult | null> {
  const pinUpdates = updatedDeps.filter(
    (dep) => dep.currentDigest && dep.newDigest,
  );
  if (!pinUpdates.length) {
    return null;
  }

  const bufYamlFile = getSiblingFileName(packageFileName, 'buf.yaml');
  const content = await readLocalFile(bufYamlFile, 'utf8');
  if (!content) {
    return null;
  }

  let updated = content;
  for (const dep of pinUpdates) {
    const host = parseUrl(coerceArray(dep.registryUrls)[0])?.host;
    const packageName = dep.packageName ?? dep.depName;
    /* v8 ignore next -- extract always supplies both host and packageName */
    if (!host || !packageName) {
      continue;
    }
    const oldPin = `${host}/${packageName}:${dep.currentDigest}`;
    const newPin = `${host}/${packageName}:${dep.newDigest}`;
    updated = updated.replaceAll(oldPin, newPin);
  }

  if (updated === content) {
    return null;
  }

  await writeLocalFile(bufYamlFile, updated);
  return {
    file: { type: 'addition', path: bufYamlFile, contents: updated },
  };
}

export async function updateArtifacts(
  updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName, updatedDeps, newPackageFileContent, config } =
    updateArtifact;
  logger.debug(`buf.updateArtifacts(${packageFileName})`);

  // The module manager keys on buf.lock; buf.gen.yaml plugin updates are
  // applied in-place by autoReplace and have nothing to regenerate.
  if (upath.basename(packageFileName) !== 'buf.lock') {
    return null;
  }

  if (isEmptyArray(updatedDeps) && !config.isLockFileMaintenance) {
    logger.debug('buf: no updated deps - returning null');
    return null;
  }

  // In this manager buf.lock is itself the package file, so it is both what we
  // rewrite and the lock `buf dep update` regenerates.
  const lockFileName = packageFileName;

  const oldLockFileContent = await readLocalFile(lockFileName);
  if (!oldLockFileContent) {
    logger.debug(`buf: no ${lockFileName} found - skipping artifact update`);
    return null;
  }

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);

    // Advance any commit pins in buf.yaml first, otherwise `buf dep update`
    // re-resolves them and reverts the bump (see advanceBufYamlPins).
    const bufYamlResult = await advanceBufYamlPins(
      packageFileName,
      updatedDeps,
    );

    const registryUrls = [
      ...new Set(updatedDeps.flatMap((dep) => coerceArray(dep.registryUrls))),
    ];
    const bufToken = getBufToken(registryUrls);

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      docker: {},
      toolConstraints: [
        {
          toolName: 'buf',
          constraint: await resolveToolConstraint(config, 'buf'),
        },
      ],
      extraEnv: bufToken ? { BUF_TOKEN: bufToken } : undefined,
    };

    await exec('buf dep update', execOptions);

    const newLockFileContent = await readLocalFile(lockFileName);
    const lockChanged =
      !!newLockFileContent &&
      oldLockFileContent.toString() !== newLockFileContent.toString();

    if (!lockChanged && !bufYamlResult) {
      logger.debug('buf: lock file is unchanged');
      return null;
    }

    const results: UpdateArtifactsResult[] = [];
    // Commit buf.yaml ahead of buf.lock so the pin advance reads first in the PR.
    if (bufYamlResult) {
      results.push(bufYamlResult);
    }
    if (lockChanged) {
      results.push({
        file: {
          type: 'addition',
          path: lockFileName,
          contents: newLockFileContent,
        },
      });
    }
    return results;
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
