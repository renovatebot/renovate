import pMap from 'p-map';
import upath from 'upath';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  localPathIsSymbolicLink,
  readLocalFile,
  readLocalSymlink,
} from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import type {
  HermitPackageDependency,
  ReadContentResult,
  UpdateHermitError,
} from './types';

/**
 * updateArtifacts runs hermit install for each updated dependencies
 */
export async function updateArtifacts({
  updatedDeps,
  packageFileName,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug({ packageFileName }, `hermit.updateArtifacts()`);

  try {
    for (const dep of updatedDeps) {
      await updateHermitPackage({ ...dep, packageFileName });
    }
  } catch (err) {
    const execErr: UpdateHermitError<any> = err;
    logger.warn(
      { stdout: execErr.stdout, stderr: execErr.stderr },
      `error updating hermit packages.`
    );
    return [execErr.from, execErr.to].map((lockFile) => ({
      artifactError: {
        lockFile,
        stderr: execErr.stderr,
      },
    }));
  }

  logger.debug(`scanning the changes after update`);

  const updateResult = await getUpdateResult(packageFileName);

  logger.debug({ updateResult }, `update result for hermit`);

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
  } else {
    contents = await readLocalFile(file, 'utf8');
  }

  if (contents === null) {
    return Promise.reject();
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
  contentRes: ReadContentResult
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
 * flattern records for modified and renamed records,
 * which has both deleted and added files in the array
 */
function flattern(arr: UpdateArtifactsResult[][]): UpdateArtifactsResult[] {
  return arr.reduce(
    (acc, nested) => [...acc, ...nested],
    [] as UpdateArtifactsResult[]
  );
}

/**
 * getUpdateResult will return the update result after `hermit install`
 * has been performed for all packages
 */
async function getUpdateResult(
  packageFileName: string
): Promise<UpdateArtifactsResult[]> {
  const hermitFolder = `${upath.dirname(packageFileName)}/`;
  const hermitChanges = await getRepoStatus(hermitFolder);
  logger.debug(
    { hermitChanges, hermitFolder },
    `hermit changes after package update`
  );

  // handle added files
  const added = await pMap(
    [...hermitChanges.created, ...hermitChanges.not_added],
    async (path: string): Promise<UpdateArtifactsResult> => {
      const contents = await getContent(path);

      return getAddResult(path, contents);
    },
    { concurrency: 5 }
  );

  const deleted = hermitChanges.deleted.map(getDeleteResult);

  const modified = await pMap(
    hermitChanges.modified,
    async (path: string): Promise<UpdateArtifactsResult[]> => {
      const contents = await getContent(path);
      return [
        getDeleteResult(path), // delete existing link
        getAddResult(path, contents), // add a new link
      ];
    },
    { concurrency: 5 }
  );

  const renamed = await pMap(
    hermitChanges.renamed,
    async (renamed): Promise<UpdateArtifactsResult[]> => {
      const from = renamed.from;
      const to = renamed.to;
      const toContents = await getContent(to);

      return [getDeleteResult(from), getAddResult(to, toContents)];
    },
    { concurrency: 5 }
  );

  return [
    // rename will need to go first, because
    // it needs to create the new link for the new version
    // for the modified links to use
    ...flattern(renamed),
    ...flattern(modified),
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
 * getHermitPackageReferenceFile returns the hermit package reference
 * file with the given package name and version
 */
function getHermitPackageReferenceFile(
  pkgName: string,
  version: string
): string {
  return `bin/.${getHermitPackage(pkgName, version)}.pkg`;
}

/**
 * updateHermitPackage runs hermit install for the given package
 */
async function updateHermitPackage(
  pkg: HermitPackageDependency
): Promise<void> {
  logger.trace({ pkg }, `hermit.updateHermitPackage()`);
  if (!pkg.depName || !pkg.currentVersion || !pkg.newValue) {
    logger.error(
      {
        depName: pkg.depName,
        currentVersion: pkg.currentVersion,
        newValue: pkg.newValue,
      },
      'missing package update information'
    );

    return Promise.reject({
      stderr: `invalid package to update`,
    });
  }
  const depName = pkg.depName;
  const currentVersion = pkg.currentVersion;
  const newValue = pkg.newValue;
  const from = getHermitPackageReferenceFile(depName, currentVersion);
  const to = getHermitPackageReferenceFile(depName, newValue);
  const fromPackage = getHermitPackage(depName, currentVersion);
  const toPackage = getHermitPackage(depName, newValue);
  const execOptions: ExecOptions = {
    docker: {
      image: 'slim',
    },
    cwdFile: pkg.packageFileName,
  };
  const execCommands = `./hermit install ${toPackage}`;
  logger.debug(
    {
      fromPackage,
      toPackage,
      pkgName: pkg.depName,
      packageFile: pkg.packageFileName,
    },
    `performing updates`
  );

  try {
    const result = await exec(execCommands, execOptions);
    logger.trace({ stdout: result.stdout }, `hermit command stdout`);
  } catch (e) {
    logger.error({ fromPackage, toPackage }, `error updating hermit package`);
    return Promise.reject({
      ...e,
      from,
      to,
    });
  }

  return Promise.resolve();
}
