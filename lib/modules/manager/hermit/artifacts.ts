import upath from 'upath';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { localPathIsSymbolicLink, readLocalSymlink } from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import * as p from '../../../util/promises';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import type { ReadContentResult } from './types';

/**
 * updateArtifacts runs hermit install for each updated dependencies
 */
export async function updateArtifacts(
  update: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName } = update;
  try {
    await updateHermitPackage(update);
  } catch (err) {
    const execErr: UpdateHermitError = err;
    logger.debug({ err }, `error updating hermit packages.`);
    return [
      {
        artifactError: {
          lockFile: `from: ${execErr.from}, to: ${execErr.to}`,
          stderr: execErr.stderr,
        },
      },
    ];
  }

  logger.debug(`scanning the changes after update`);

  let updateResult: UpdateArtifactsResult[] | null = null;

  try {
    updateResult = await getUpdateResult(packageFileName);
    logger.debug({ updateResult }, `update result for hermit`);
  } catch (err) {
    logger.debug({ err }, 'Error getting hermet update results');
    return [
      {
        artifactError: {
          stderr: err.message,
        },
      },
    ];
  }

  return updateResult;
}

/**
 * getContent returns the content of either link or a normal file
 */
async function getContent(file: string): Promise<ReadContentResult> {
  let contents: string | null = '';
  const isSymlink = await localPathIsSymbolicLink(file);

  if (isSymlink) {
    contents = await readLocalSymlink(file);
  }

  if (contents === null) {
    throw new Error(`error getting content for ${file}`);
  }

  return {
    isSymlink,
    contents,
  };
}

/**
 * getAddResult returns the UpdateArtifactsResult for the added files
 */
function getAddResult(
  path: string,
  contentRes: ReadContentResult,
): UpdateArtifactsResult {
  return {
    file: {
      type: 'addition',
      path,
      contents: contentRes.contents,
      isSymlink: contentRes.isSymlink,
      isExecutable: contentRes.isExecutable,
    },
  };
}

/**
 * getDeleteResult returns the UpdateArtifactsResult for deleted files
 */
function getDeleteResult(path: string): UpdateArtifactsResult {
  return {
    file: {
      type: 'deletion',
      path,
    },
  };
}

/**
 * getUpdateResult will return the update result after `hermit install`
 * has been performed for all packages
 */
async function getUpdateResult(
  packageFileName: string,
): Promise<UpdateArtifactsResult[]> {
  const hermitFolder = `${upath.dirname(packageFileName)}/`;
  const hermitChanges = await getRepoStatus(hermitFolder);
  logger.debug(
    { hermitChanges, hermitFolder },
    `hermit changes after package update`,
  );

  // handle added files
  const added = await p.map(
    [...hermitChanges.created, ...hermitChanges.not_added],
    async (path: string): Promise<UpdateArtifactsResult> => {
      const contents = await getContent(path);

      return getAddResult(path, contents);
    },
  );

  const deleted = hermitChanges.deleted.map(getDeleteResult);

  const modified = await p.map(
    hermitChanges.modified,
    async (path: string): Promise<UpdateArtifactsResult[]> => {
      const contents = await getContent(path);
      return [
        getDeleteResult(path), // delete existing link
        getAddResult(path, contents), // add a new link
      ];
    },
  );

  const renamed = await p.map(
    hermitChanges.renamed,
    async (renamed): Promise<UpdateArtifactsResult[]> => {
      const from = renamed.from;
      const to = renamed.to;
      const toContents = await getContent(to);

      return [getDeleteResult(from), getAddResult(to, toContents)];
    },
  );

  return [
    // rename will need to go first, because
    // it needs to create the new link for the new version
    // for the modified links to use
    ...renamed.flat(),
    ...modified.flat(),
    ...added,
    ...deleted,
  ];
}

/**
 * getHermitPackage returns the hermit package for running the hermit install
 */
function getHermitPackage(name: string, version: string): string {
  return `${name}-${version}`;
}

/**
 * updateHermitPackage runs hermit install for the given package
 */
async function updateHermitPackage(update: UpdateArtifact): Promise<void> {
  logger.trace({ update }, `hermit.updateHermitPackage()`);

  const toInstall = [];
  const from = [];

  for (const pkg of update.updatedDeps) {
    if (!pkg.depName || !pkg.currentVersion || !pkg.newValue) {
      logger.debug(
        {
          depName: pkg.depName,
          currentVersion: pkg.currentVersion,
          newValue: pkg.newValue,
        },
        'missing package update information',
      );

      throw new UpdateHermitError(
        getHermitPackage(pkg.depName ?? '', pkg.currentVersion ?? ''),
        getHermitPackage(pkg.depName ?? '', pkg.newValue ?? ''),
        'invalid package to update',
      );
    }

    const depName = pkg.depName;
    const currentVersion = pkg.currentVersion;
    const newValue = pkg.newValue;
    const fromPackage = getHermitPackage(depName, currentVersion);
    const toPackage = getHermitPackage(depName, newValue);
    toInstall.push(toPackage);
    from.push(fromPackage);
  }

  const execOptions: ExecOptions = {
    docker: {},
    cwdFile: update.packageFileName,
  };

  const packagesToInstall = toInstall.join(' ');
  const fromPackages = from.join(' ');

  const execCommands = `./hermit install ${packagesToInstall}`;
  logger.debug(
    {
      packageFile: update.packageFileName,
      packagesToInstall,
    },
    `performing updates`,
  );

  try {
    const result = await exec(execCommands, execOptions);
    logger.trace({ stdout: result.stdout }, `hermit command stdout`);
  } catch (e) {
    logger.warn({ err: e }, `error updating hermit package`);
    throw new UpdateHermitError(
      fromPackages,
      packagesToInstall,
      e.stderr,
      e.stdout,
    );
  }
}

export class UpdateHermitError extends Error {
  stdout: string;
  stderr: string;
  from: string;
  to: string;

  constructor(from: string, to: string, stderr: string, stdout = '') {
    super();
    this.stdout = stdout;
    this.stderr = stderr;
    this.from = from;
    this.to = to;
  }
}
