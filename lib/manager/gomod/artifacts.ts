import is from '@sindresorhus/is';
import { quote } from 'shlex';
import { dirname, join } from 'upath';
import { getAdminConfig } from '../../config/admin';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { PLATFORM_TYPE_GITHUB } from '../../constants/platforms';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import { ensureCacheDir, readLocalFile, writeLocalFile } from '../../util/fs';
import { getRepoStatus } from '../../util/git';
import { find, findAll } from '../../util/host-rules';
import { isValid } from '../../versioning/semver';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types';

function getGoEnvironmentVariables(): NodeJS.ProcessEnv {
  const goEnvVariables: NodeJS.ProcessEnv = {};
  const goPrivate: string[] = [];

  // passthrough the GOPRIVATE environment variable as the first element of the goPrivate array
  if (process.env.GOPRIVATE) {
    goPrivate.push(process.env.GOPRIVATE);
  }

  // passthrough the GIT_CONFIG_COUNT environment variable as start value of the index count
  let gitEnvCounter: number = parseInt(process.env.GIT_CONFIG_COUNT, 10);
  if (isNaN(gitEnvCounter)) {
    logger.warn(
      `Found GIT_CONFIG_COUNT env variable, but couldn't parse the value to an integer: ${process.env.GIT_CONFIG_COUNT}. Ignoring it.`
    );
    gitEnvCounter = 0;
  }

  const credentials = find({
    hostType: PLATFORM_TYPE_GITHUB,
    url: 'https://api.github.com/',
  });

  if (credentials?.token) {
    const token = quote(credentials.token);
    // gitEnvCounter is zero indexed, thus we first create the variables and then increment the counter
    goEnvVariables[
      `GIT_CONFIG_KEY_${gitEnvCounter}`
    ] = `url.https://${token}@github.com/.insteadOf`;
    goEnvVariables[`GIT_CONFIG_VALUE_${gitEnvCounter}`] = `https://github.com/`;
    gitEnvCounter += 1;
  }

  // get all credentials we have for go using git
  const goGitCredentials =
    findAll({
      hostType: 'go-git',
    }) || [];

  for (const goGitCredential of goGitCredentials) {
    // Check that both a token exists and a matchHost
    if (goGitCredential.token && goGitCredential.matchHost) {
      const token = quote(goGitCredential.token);
      // gitEnvCounter is zero indexed, thus we first create the variables and then increment the counter
      goEnvVariables[
        `GIT_CONFIG_KEY_${gitEnvCounter}`
      ] = `url.https://${token}@${goGitCredential.matchHost}/.insteadOf`;
      goEnvVariables[
        `GIT_CONFIG_VALUE_${gitEnvCounter}`
      ] = `https://${goGitCredential.matchHost}/`;
      gitEnvCounter += 1;
      // add list of matched Hosts to goPrivate variable
      goPrivate.push(goGitCredential.matchHost);
    }
  }

  // set the GIT_CONFIG_COUNT, if larger then 0, to the number of KEY/Value pairs
  if (gitEnvCounter > 0) {
    goEnvVariables.GIT_CONFIG_COUNT = gitEnvCounter.toString();
  }

  // create and set GOPRIVATE environment variable to pull directly from source (in this case git)
  const goPrivateEnvVariable: string = goPrivate.join(',');
  goEnvVariables.GOPRIVATE = goPrivateEnvVariable;
  return goEnvVariables;
}

function getUpdateImportPathCmds(
  updatedDeps: PackageDependency[],
  { constraints, newMajor }: UpdateArtifactsConfig
): string[] {
  const updateImportCommands = updatedDeps
    .map((dep) => dep.depName)
    .filter((x) => !x.startsWith('gopkg.in'))
    .map((depName) => `mod upgrade --mod-name=${depName} -t=${newMajor}`);

  if (updateImportCommands.length > 0) {
    let installMarwanModArgs =
      'install github.com/marwan-at-work/mod/cmd/mod@latest';
    const gomodModCompatibility = constraints?.gomodMod;
    if (gomodModCompatibility) {
      if (
        gomodModCompatibility.startsWith('v') &&
        isValid(gomodModCompatibility.replace(/^v/, ''))
      ) {
        installMarwanModArgs = installMarwanModArgs.replace(
          /@latest$/,
          `@${gomodModCompatibility}`
        );
      } else {
        logger.debug(
          { gomodModCompatibility },
          'marwan-at-work/mod compatibility range is not valid - skipping'
        );
      }
    } else {
      logger.debug(
        'No marwan-at-work/mod compatibility range found - installing marwan-at-work/mod latest'
      );
    }
    updateImportCommands.unshift(`go ${installMarwanModArgs}`);
  }

  return updateImportCommands;
}

function useModcacherw(goVersion: string): boolean {
  if (!is.string(goVersion)) {
    return true;
  }

  const [, majorPart, minorPart] = /(\d+)\.(\d+)/.exec(goVersion) ?? [];
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

  const goPath = await ensureCacheDir('./others/go', 'GOPATH');

  const sumFileName = goModFileName.replace(/\.mod$/, '.sum');
  const existingGoSumContent = await readLocalFile(sumFileName);
  if (!existingGoSumContent) {
    logger.debug('No go.sum found');
    return null;
  }

  const vendorDir = join(dirname(goModFileName), 'vendor/');
  const vendorModulesFileName = join(vendorDir, 'modules.txt');
  const useVendor = (await readLocalFile(vendorModulesFileName)) !== null;

  try {
    const massagedGoMod = newGoModContent.replace(
      /\n(replace\s+[^\s]+\s+=>\s+\.\.\/.*)/g,
      '\n// renovate-replace $1'
    );
    if (massagedGoMod !== newGoModContent) {
      logger.debug('Removed some relative replace statements from go.mod');
    }
    await writeLocalFile(goModFileName, massagedGoMod);

    const cmd = 'go';
    const execOptions: ExecOptions = {
      cwdFile: goModFileName,
      extraEnv: {
        GOPATH: goPath,
        GOPROXY: process.env.GOPROXY,
        GONOPROXY: process.env.GONOPROXY,
        GONOSUMDB: process.env.GONOSUMDB,
        GOFLAGS: useModcacherw(config.constraints?.go) ? '-modcacherw' : null,
        CGO_ENABLED: getAdminConfig().binarySource === 'docker' ? '0' : null,
        ...getGoEnvironmentVariables(),
      },
      docker: {
        image: 'go',
        tagConstraint: config.constraints?.go,
        tagScheme: 'npm',
        volumes: [goPath],
      },
    };

    const execCommands = [];

    let args = 'get -d ./...';
    logger.debug({ cmd, args }, 'go get command included');
    execCommands.push(`${cmd} ${args}`);

    // Update import paths on major updates above v1
    const isImportPathUpdateRequired =
      config.postUpdateOptions?.includes('gomodUpdateImportPaths') &&
      config.updateType === 'major' &&
      config.newMajor > 1;
    if (isImportPathUpdateRequired) {
      const updateImportCmds = getUpdateImportPathCmds(updatedDeps, config);
      if (updateImportCmds.length > 0) {
        logger.debug(updateImportCmds, 'update import path commands included');
        // The updates
        execCommands.push(...updateImportCmds);
      }
    }

    const isGoModTidyRequired =
      config.postUpdateOptions?.includes('gomodTidy') ||
      config.updateType === 'major';
    if (isGoModTidyRequired) {
      args = 'mod tidy';
      logger.debug({ cmd, args }, 'go mod tidy command included');
      execCommands.push(`${cmd} ${args}`);
    }

    if (useVendor) {
      args = 'mod vendor';
      logger.debug({ cmd, args }, 'go mod vendor command included');
      execCommands.push(`${cmd} ${args}`);
      if (isGoModTidyRequired) {
        args = 'mod tidy';
        logger.debug({ cmd, args }, 'go mod tidy command included');
        execCommands.push(`${cmd} ${args}`);
      }
    }

    // We tidy one more time as a solution for #6795
    if (isGoModTidyRequired) {
      args = 'mod tidy';
      logger.debug({ cmd, args }, 'additional go mod tidy command included');
      execCommands.push(`${cmd} ${args}`);
    }

    await exec(execCommands, execOptions);

    const status = await getRepoStatus();
    if (!status.modified.includes(sumFileName)) {
      return null;
    }

    logger.debug('Returning updated go.sum');
    const res: UpdateArtifactsResult[] = [
      {
        file: {
          name: sumFileName,
          contents: await readLocalFile(sumFileName),
        },
      },
    ];

    // Include all the .go file import changes
    if (isImportPathUpdateRequired) {
      logger.debug('Returning updated go source files for import path changes');
      for (const f of status.modified) {
        if (f.endsWith('.go')) {
          res.push({
            file: {
              name: f,
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
              name: f,
              contents: await readLocalFile(f),
            },
          });
        }
      }
      for (const f of status.deleted || []) {
        res.push({
          file: {
            name: '|delete|',
            contents: f,
          },
        });
      }
    }

    const finalGoModContent = (
      await readLocalFile(goModFileName, 'utf8')
    ).replace(/\/\/ renovate-replace /g, '');
    if (finalGoModContent !== newGoModContent) {
      logger.debug('Found updated go.mod after go.sum update');
      res.push({
        file: {
          name: goModFileName,
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
