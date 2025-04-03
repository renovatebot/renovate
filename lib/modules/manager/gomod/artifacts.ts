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
import { filterMap } from '../../../util/filter-map';
import {
  ensureCacheDir,
  findLocalSiblingOrParent,
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
import { getExtraDepsNotice } from './artifacts-extra';

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

  const goModDir = upath.dirname(goModFileName);

  const vendorDir = upath.join(goModDir, 'vendor/');
  const vendorModulesFileName = upath.join(vendorDir, 'modules.txt');
  const useVendor =
    !!config.postUpdateOptions?.includes('gomodVendor') ||
    (!config.postUpdateOptions?.includes('gomodSkipVendor') &&
      (await readLocalFile(vendorModulesFileName)) !== null);
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

  const goModDirectivesNew = getGoModDirectives(newGoModContent);
  const goBootstrapToolchainRange =
    config.constraints?.go ?? `^${goModDirectivesNew.goDirective}`; // any patch of configured constraint OR at least equal to go directive

  const getFlags = ['-t'];
  if (!semver.satisfies(goModDirectivesNew.goDirectiveMinimal, '>=1.17.0')) {
    getFlags.unshift('-d');
  }

  const extraGetArguments: string[] = [];
  if (semver.satisfies(goModDirectivesNew.goDirectiveMinimal, '>=1.21.0')) {
    // config.constraints.go defines the minimal bootstrap toolchain version (with binarySource='install|docker' @latest is installed)
    // config.constraints.go also defines the maximal go version (unless the go directive is already at a greater version)
    // that constraint is to be accounted for by the 'go get' command which eventually updates the go directive in go.mod
    // if a dependency requires a greater version, it will be downgraded to satisfy the constraint
    if (config.constraints?.go) {
      const goConstraintMinor = semver.minVersion(config.constraints.go);
      if (goConstraintMinor) {
        const goConstraint = semver
          .maxSatisfying(
            [goModDirectivesNew.goDirective, goConstraintMinor.version],
            `<${goConstraintMinor.inc('minor').version}`,
          )
          ?.toString();
        if (
          goConstraint &&
          semver.satisfies(goModDirectivesNew.goDirective, `<=${goConstraint}`)
        ) {
          if (
            goModDirectivesNew.toolchainDirective &&
            semver.satisfies(
              goModDirectivesNew.toolchainDirective,
              `>=${goConstraint}`,
            )
          ) {
            // if a toolchain directive that does support the constraint was present, do not modify it
            extraGetArguments.push(
              `toolchain@${goModDirectivesNew.toolchainDirective}`,
            );
          }

          // if the go directive's minor is greater or equal to the constraint's minor, keep it
          // if the go directive is lower than the constraint, bump it
          // NOTE: Unfortunately there is no way to detect when the bump could be skipped
          //       because the dependencies' go.mod is not in 'updatedDeps' to determine
          //       which highest version is actually required.
          extraGetArguments.push(`go@${goConstraint}`);
          // TODO: if we are already at latest compatible version, then renovate still bumps it
          //        instead the PR should be erroring out!!
        }
      }
    }

    // allow explicit and implicit toolchain and go upgrades
    // but avoid writing the toolchain directive to go.mod if it was not present before
    if (!goModDirectivesNew.toolchainDirective) {
      extraGetArguments.unshift(`toolchain@none`);
    }
  }

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
        /* v8 ignore next -- TODO: add test */
        GOFLAGS: useModcacherw(goBootstrapToolchainRange)
          ? '-modcacherw'
          : null,
        CGO_ENABLED: GlobalConfig.get('binarySource') === 'docker' ? '0' : null,
        ...getGitEnvironmentVariables(['go']),
      },
      docker: {},
      toolConstraints: [
        {
          toolName: 'golang',
          // NOTE: the go toolchain, when >=1.22 installs newer toolchain versions on-the-fly
          //       when required by a dependency and GOTOOLCHAIN=auto (default)
          constraint: goBootstrapToolchainRange,
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

    let args =
      `get ${getFlags.join(' ')} ${goGetDirs ?? './...'} ${extraGetArguments.join(' ')}`.trimEnd();
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

    const goWorkSumFileName = upath.join(goModDir, 'go.work.sum');
    if (useVendor) {
      // If we find a go.work, then use go workspace vendoring.
      const goWorkFile = await findLocalSiblingOrParent(
        goModFileName,
        'go.work',
      );

      if (goWorkFile) {
        args = 'work vendor';
        logger.debug('using go work vendor');
        execCommands.push(`${cmd} ${args}`);

        args = 'work sync';
        logger.debug('using go work sync');
        execCommands.push(`${cmd} ${args}`);
      } else {
        args = 'mod vendor';
        logger.debug('using go mod vendor');
        execCommands.push(`${cmd} ${args}`);
      }

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

    const res: UpdateArtifactsResult[] = [];
    const status = await getRepoStatus();
    if (
      status.modified.length === 0 &&
      updatedDeps.length > 0 &&
      config.constraints?.go
    ) {
      const downgradeNotice = `Updates are constrained to go version ${config.constraints.go} but the dependency required a more recent version.\nTherefore, the update was discarded.`;

      logger.debug('Returning no update warning');
      res.push({
        notice: {
          file: goModFileName,
          message: downgradeNotice,
        },
      });

      return res;
    }
    if (
      !status.modified.includes(sumFileName) &&
      !status.modified.includes(goModFileName) &&
      !status.modified.includes(goWorkSumFileName)
    ) {
      return null;
    }

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

    if (status.modified.includes(goWorkSumFileName)) {
      logger.debug('Returning updated go.work.sum');
      res.push({
        file: {
          type: 'addition',
          path: goWorkSumFileName,
          contents: await readLocalFile(goWorkSumFileName),
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
      const artifactResult: UpdateArtifactsResult = {
        file: {
          type: 'addition',
          path: goModFileName,
          contents: finalGoModContent,
        },
      };

      const updatedDepNames = filterMap(updatedDeps, (dep) => dep?.depName);
      const extraDepsNotice = getExtraDepsNotice(
        newGoModContent,
        finalGoModContent,
        updatedDepNames,
      );

      if (extraDepsNotice) {
        artifactResult.notice = {
          file: goModFileName,
          message: extraDepsNotice,
        };
      }

      logger.debug('Found updated go.mod after go.sum update');
      res.push(artifactResult);
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

function getGoModDirectives(content: string): {
  toolchainDirective?: string;
  goDirective: string;
  goDirectiveMinimal: string;
} {
  const toolchainMatch = regEx(/^toolchain\s*go(?<gofull>\d+(\.\d+)+)$/m).exec(
    content,
  );
  const toolchainVer = toolchainMatch?.groups?.gofull;

  const goMatch = regEx(/^go\s*(?<gofull>(?<gover>\d+\.\d+)(\.\d+)?)$/m).exec(
    content,
  );

  // go mod spec says if go directive is missing it's 1.16
  const goVer = goMatch?.groups?.gover ?? '1.16';
  let goFull = goMatch?.groups?.gofull ?? '1.16.0';
  if (goFull === goVer) {
    goFull = `${goFull}.0`;
  }

  return {
    toolchainDirective: toolchainVer,
    goDirective: goFull,
    goDirectiveMinimal: `${goVer}.0`,
  };
}
