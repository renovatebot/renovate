import { isNonEmptyArray } from '@sindresorhus/is';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { findGithubToken } from '../../../util/check-token.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions, ExtraEnv } from '../../../util/exec/types.ts';
import {
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import { collectFileChanges } from '../../../util/git/file-changes.ts';
import { getRepoStatus } from '../../../util/git/index.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import {
  artifactErrorResult,
  fileChangesToArtifactResults,
  resolveToolConstraint,
} from '../util.ts';

/**
 * Returns the github.com token that the `github-tags` lookups use as
 * `GITHUB_APM_PAT`: a `github-tags` host rule's, or else the `github` one's.
 */
function getGithubTokenEnv(): ExtraEnv {
  const url = 'https://api.github.com/';
  const lookupRule = hostRules.find({ hostType: GithubTagsDatasource.id, url });
  const token = findGithubToken(
    lookupRule.token ? lookupRule : hostRules.find({ hostType: 'github', url }),
  );
  return token ? { GITHUB_APM_PAT: token } : {};
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`apm.updateArtifacts(${packageFileName})`);
  const { isLockFileMaintenance } = config;

  if (!isNonEmptyArray(updatedDeps) && !isLockFileMaintenance) {
    logger.debug('apm: no updated deps - returning null');
    return null;
  }

  const lockFileName = getSiblingFileName(packageFileName, 'apm.lock.yaml');
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug('apm: no lock file found');
    return null;
  }

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      // APM reads a token for private github.com dependencies from its own
      // environment variables only: it drops the `GIT_CONFIG_*` URL rewrites
      // that `withGitEnvironment()` would pass.
      extraEnv: getGithubTokenEnv(),
      docker: {},
      toolConstraints: [
        {
          toolName: 'apm',
          constraint: await resolveToolConstraint(config, 'apm'),
        },
      ],
    };
    // Plain `apm install` only syncs the lockfile to the manifest. For lock
    // file maintenance, `--update` re-resolves each dependency to the latest
    // ref `apm.yml` allows, without editing `apm.yml`. (`apm update` would also
    // move full-SHA pins in `apm.yml`, which is for Renovate's own updates.)
    //
    // The lockfile stays in place. It is APM's record of which deployed files
    // it owns, so without it `apm install` skips the committed files as
    // unmanaged: the ownership ledger and file hashes are lost, and when a ref
    // moves, the deployed files stay at the old version.
    await exec(
      isLockFileMaintenance ? 'apm install --update' : 'apm install',
      execOptions,
    );

    // The command regenerates the lockfile and re-deploys the harness
    // directories (`.github/`, `.claude/`, ...) that APM consumers commit, so
    // return every file it changed - not just the lockfile - or the committed
    // instruction files go stale after a bump. `apm_modules/` is the gitignored
    // cache, so it is not reported here.
    const status = await getRepoStatus();
    const res = fileChangesToArtifactResults([
      ...(await collectFileChanges(status, {
        include: ['modified', 'not_added'],
        // the manifest itself is committed as an updated package file
        filter: (path) => path !== packageFileName,
      })),
      ...(await collectFileChanges(status, { include: ['deleted'] })),
    ]);
    if (!res.length) {
      logger.debug('apm: no changed files after install');
      return null;
    }
    return res;
  } catch (err) {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, `Failed to update ${lockFileName}`);
    return artifactErrorResult(lockFileName, err);
  }
}
