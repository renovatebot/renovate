import is from '@sindresorhus/is';
import semver from 'semver';
import { quote } from 'shlex';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  ensureCacheDir,
  isValidLocalPath,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import { getGitEnvironmentVariables } from '../../../util/git/auth';
import { regEx } from '../../../util/regex';
import { isValid } from '../../versioning/semver';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types';

const { major, valid } = semver;

function getUpdateImportPathCmds(
  updatedDeps: PackageDependency[],
  { constraints }: UpdateArtifactsConfig,
): string[] {
  // Check if we fail to parse any major versions and log that they're skipped
  const invalidMajorDeps = updatedDeps.filter(
    ({ newVersion }) => !valid(newVersion),
  );
  if (invalidMajorDeps.length > 0) {
    invalidMajorDeps.forEach(({ depName }) =>
      logger.warn(
        { depName },
        'Ignoring dependency: Could not get major version',
      ),
    );
  }

  const updateImportCommands = updatedDeps
    .filter(
      ({ newVersion }) =>
        valid(newVersion) && !newVersion!.endsWith('+incompatible'),
    )
    .map(({ depName, newVersion }) => ({
      depName: depName!,
      newMajor: major(newVersion!),
    }))
    // Skip path updates going from v0 to v1
    .filter(
      ({ depName, newMajor }) =>
        depName.startsWith('gopkg.in/') || newMajor > 1,
    )

    .map(
      ({ depName, newMajor }) =>
        `mod upgrade --mod-name=${depName} -t=${newMajor}`,
    );

  if (updateImportCommands.length > 0) {
    let installMarwanModArgs =
      'install github.com/marwan-at-work/mod/cmd/mod@latest';
    const gomodModCompatibility = constraints?.gomodMod;
    if (gomodModCompatibility) {
      if (
        gomodModCompatibility.startsWith('v') &&
        isValid(gomodModCompatibility.replace(regEx(/^v/), ''))
      ) {
        installMarwanModArgs = installMarwanModArgs.replace(
          regEx(/@latest$/),
          `@${gomodModCompatibility}`,
        );
      } else {
        logger.debug(
          { gomodModCompatibility },
          'marwan-at-work/mod compatibility range is not valid - skipping',
        );
      }
    } else {
      logger.debug(
        'No marwan-at-work/mod compatibility range found - installing marwan-at-work/mod latest',
      );
    }
    updateImportCommands.unshift(`go ${installMarwanModArgs}`);
  }

  return updateImportCommands;
}

function useModcacherw(goVersion: string | undefined): boolean {
  if (!is.string(goVersion)) {
    return true;
  }

  const [, majorPart, minorPart] = coerceArray(
    regEx(/(\d+)\.(\d+)/).exec(goVersion),
  );
  const [major, minor] = [majorPart, minorPart].map((x) => parseInt(x, 10));

  return (
    !Number.isNaN(major) &&
    !Number.isNaN(minor) &&
    (major > 1 || (major === 1 && minor >= 14))
  );
}

export async function updateArtifacts({
  packageFileName: goModFileName,
  updatedDeps,
  newPackageFileContent: newGoModContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`gomod.updateArtifacts(${goModFileName})`);

  const sumFileName = goModFileName.replace(regEx(/\.mod$/), '.sum');
  const existingGoSumContent = await readLocalFile(sumFileName);
  if (!existingGoSumContent) {
    logger.debug('No go.sum found');
    return null;
  }

  const vendorDir = upath.join(upath.dirname(goModFileName), 'vendor/');
  const vendorModulesFileName = upath.join(vendorDir, 'modules.txt');
  const useVendor = (await readLocalFile(vendorModulesFileName)) !== null;

  let massagedGoMod = newGoModContent;

  if (config.postUpdateOptions?.includes('gomodMassage')) {
    // Regex match inline replace directive, example:
    // replace golang.org/x/net v1.2.3 => example.com/fork/net v1.4.5
    // https://go.dev/ref/mod#go-mod-file-replace

    // replace bracket after comments, so it doesn't break the regex, doing a complex regex causes problems
    // when there's a comment and ")" after it, the regex will read replace block until comment.. and stop.
    massagedGoMod = massagedGoMod
      .split('\n')
      .map((line) => {
        if (line.trim().startsWith('//')) {
          return line.replace(')', 'renovate-replace-bracket');
        }
        return line;
      })
      .join('\n');

    const inlineReplaceRegEx = regEx(
      /(\r?\n)(replace\s+[^\s]+\s+=>\s+\.\.\/.*)/g,
    );

    // $1 will be matched with the (\r?n) group
    // $2 will be matched with the inline replace match, example
    // "// renovate-replace replace golang.org/x/net v1.2.3 => example.com/fork/net v1.4.5"
    const inlineCommentOut = '$1// renovate-replace $2';

    // Regex match replace directive block, example:
    // replace (
    //     golang.org/x/net v1.2.3 => example.com/fork/net v1.4.5
    // )
    const blockReplaceRegEx = regEx(/(\r?\n)replace\s*\([^)]+\s*\)/g);

    /**
     * replacerFunction for commenting out replace blocks
     * @param match A string representing a golang replace directive block
     * @returns A commented out block with // renovate-replace
     */
    const blockCommentOut = (match: string): string =>
      match.replace(/(\r?\n)/g, '$1// renovate-replace ');

    // Comment out golang replace directives
    massagedGoMod = massagedGoMod
      .replace(inlineReplaceRegEx, inlineCommentOut)
      .replace(blockReplaceRegEx, blockCommentOut);

    if (massagedGoMod !== newGoModContent) {
      logger.debug(
        'Removed some relative replace statements and comments from go.mod',
      );
    }
  }
  const goConstraints =
    config.constraints?.go ?? (await getGoConstraints(goModFileName));

  try {
    await writeLocalFile(goModFileName, massagedGoMod);

    const cmd = 'go';
    const execOptions: ExecOptions = {
      cwdFile: goModFileName,
      extraEnv: {
        GOPATH: await ensureCacheDir('go'),
        GOPROXY: process.env.GOPROXY,
        GOPRIVATE: process.env.GOPRIVATE,
        GONOPROXY: process.env.GONOPROXY,
        GONOSUMDB: process.env.GONOSUMDB,
        GOSUMDB: process.env.GOSUMDB,
        GOINSECURE: process.env.GOINSECURE,
        GOFLAGS: useModcacherw(goConstraints)
          ? '-modcacherw'
          : /* istanbul ignore next: hard to test */ null,
        CGO_ENABLED: GlobalConfig.get('binarySource') === 'docker' ? '0' : null,
        ...getGitEnvironmentVariables(['go']),
      },
      docker: {},
      toolConstraints: [
        {
          toolName: 'golang',
          constraint: goConstraints,
        },
      ],
    };

    const execCommands: string[] = [];

    let goGetDirs: string | undefined;
    if (config.goGetDirs) {
      goGetDirs = config.goGetDirs
        .filter((dir) => {
          const isValid = isValidLocalPath(dir);
          if (!isValid) {
            logger.warn({ dir }, 'Invalid path in goGetDirs');
          }
          return isValid;
        })
        .map(quote)
        .join(' ');

      if (goGetDirs === '') {
        throw new Error('Invalid goGetDirs');
      }
    }

    let args = `get -d -t ${goGetDirs ?? './...'}`;
    logger.trace({ cmd, args }, 'go get command included');
    execCommands.push(`${cmd} ${args}`);

    // Update import paths on major updates
    const isImportPathUpdateRequired =
      config.postUpdateOptions?.includes('gomodUpdateImportPaths') &&
      config.updateType === 'major';

    if (isImportPathUpdateRequired) {
      const updateImportCmds = getUpdateImportPathCmds(updatedDeps, config);
      if (updateImportCmds.length > 0) {
        logger.debug(updateImportCmds, 'update import path commands included');
        // The updates
        execCommands.push(...updateImportCmds);
      }
    }

    const mustSkipGoModTidy =
      !config.postUpdateOptions?.includes('gomodUpdateImportPaths') &&
      config.updateType === 'major';
    if (mustSkipGoModTidy) {
      logger.debug('go mod tidy command skipped');
    }

    let tidyOpts = '';
    if (config.postUpdateOptions?.includes('gomodTidy1.17')) {
      tidyOpts += ' -compat=1.17';
    }
    if (config.postUpdateOptions?.includes('gomodTidyE')) {
      tidyOpts += ' -e';
    }

    const isGoModTidyRequired =
      !mustSkipGoModTidy &&
      (config.postUpdateOptions?.includes('gomodTidy') === true ||
        config.postUpdateOptions?.includes('gomodTidy1.17') === true ||
        config.postUpdateOptions?.includes('gomodTidyE') === true ||
        (config.updateType === 'major' && isImportPathUpdateRequired));
    if (isGoModTidyRequired) {
      args = 'mod tidy' + tidyOpts;
      logger.debug('go mod tidy command included');
      execCommands.push(`${cmd} ${args}`);
    }

    if (useVendor) {
      args = 'mod vendor';
      logger.debug('go mod tidy command included');
      execCommands.push(`${cmd} ${args}`);
      if (isGoModTidyRequired) {
        args = 'mod tidy' + tidyOpts;
        logger.debug('go mod tidy command included');
        execCommands.push(`${cmd} ${args}`);
      }
    }

    // We tidy one more time as a solution for #6795
    if (isGoModTidyRequired) {
      args = 'mod tidy' + tidyOpts;
      logger.debug('go mod tidy command included');
      execCommands.push(`${cmd} ${args}`);
    }

    await exec(execCommands, execOptions);

    const status = await getRepoStatus();
    if (
      !status.modified.includes(sumFileName) &&
      !status.modified.includes(goModFileName)
    ) {
      return null;
    }

    const res: UpdateArtifactsResult[] = [];
    if (status.modified.includes(sumFileName)) {
      logger.debug('Returning updated go.sum');
      res.push({
        file: {
          type: 'addition',
          path: sumFileName,
          contents: await readLocalFile(sumFileName),
        },
      });
    }

    // Include all the .go file import changes
    if (isImportPathUpdateRequired) {
      logger.debug('Returning updated go source files for import path changes');
      for (const f of status.modified) {
        if (f.endsWith('.go')) {
          res.push({
            file: {
              type: 'addition',
              path: f,
              contents: await readLocalFile(f),
            },
          });
        }
      }
    }

    if (useVendor) {
      for (const f of status.modified.concat(status.not_added)) {
        if (f.startsWith(vendorDir)) {
          res.push({
            file: {
              type: 'addition',
              path: f,
              contents: await readLocalFile(f),
            },
          });
        }
      }
      for (const f of coerceArray(status.deleted)) {
        res.push({
          file: {
            type: 'deletion',
            path: f,
          },
        });
      }
    }

    // TODO: throws in tests (#22198)
    const finalGoModContent = (await readLocalFile(goModFileName, 'utf8'))!
      .replace(regEx(/\/\/ renovate-replace /g), '')
      .replace(regEx(/renovate-replace-bracket/g), ')');
    if (finalGoModContent !== newGoModContent) {
      logger.debug('Found updated go.mod after go.sum update');
      res.push({
        file: {
          type: 'addition',
          path: goModFileName,
          contents: finalGoModContent,
        },
      });
    }
    return res;
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, 'Failed to update go.sum');
    return [
      {
        artifactError: {
          lockFile: sumFileName,
          stderr: err.message,
        },
      },
    ];
  }
}

async function getGoConstraints(
  goModFileName: string,
): Promise<string | undefined> {
  const content = (await readLocalFile(goModFileName, 'utf8')) ?? null;
  if (!content) {
    return undefined;
  }
  const re = regEx(/^go\s*(?<gover>\d+\.\d+)$/m);
  const match = re.exec(content);
  if (!match?.groups?.gover) {
    return undefined;
  }
  return '^' + match.groups.gover;
}
