import is from '@sindresorhus/is';
import upath from 'upath';
import { GlobalConfig } from '../../config/global';
import { PlatformId } from '../../constants';
import { TEMPORARY_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';
import { exec } from '../../util/exec';
import type { ExecOptions } from '../../util/exec/types';
import { ensureCacheDir, readLocalFile, writeLocalFile } from '../../util/fs';
import { getRepoStatus } from '../../util/git';
import { getGitAuthenticatedEnvironmentVariables } from '../../util/git/auth';
import { find, getAll } from '../../util/host-rules';
import { regEx } from '../../util/regex';
import { createURLFromHostOrURL, validateUrl } from '../../util/url';
import { isValid } from '../../versioning/semver';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types';

function getGitEnvironmentVariables(): NodeJS.ProcessEnv {
  let environmentVariables: NodeJS.ProcessEnv = {};

  // hard-coded logic to use authentication for github.com based on the githubToken for api.github.com
  const githubToken = find({
    hostType: PlatformId.Github,
    url: 'https://api.github.com/',
  });

  if (githubToken?.token) {
    environmentVariables = getGitAuthenticatedEnvironmentVariables(
      'https://github.com/',
      githubToken
    );
  }

  // get extra host rules for other git-based Go Module hosts
  const hostRules = getAll() || [];

  const goGitAllowedHostType: string[] = [
    // All known git platforms
    PlatformId.Azure,
    PlatformId.Bitbucket,
    PlatformId.BitbucketServer,
    PlatformId.Gitea,
    PlatformId.Github,
    PlatformId.Gitlab,
    // plus all without a host type (=== undefined)
    undefined,
  ];

  // for each hostRule we add additional authentication variables to the environmentVariables
  for (const hostRule of hostRules) {
    if (
      hostRule?.token &&
      hostRule.matchHost &&
      goGitAllowedHostType.includes(hostRule.hostType)
    ) {
      const httpUrl = createURLFromHostOrURL(hostRule.matchHost).toString();
      if (validateUrl(httpUrl)) {
        logger.debug(
          `Adding Git authentication for Go Module retrieval for ${httpUrl} using token auth.`
        );
        environmentVariables = getGitAuthenticatedEnvironmentVariables(
          httpUrl,
          hostRule,
          environmentVariables
        );
      } else {
        logger.warn(
          `Could not parse registryUrl ${hostRule.matchHost} or not using http(s). Ignoring`
        );
      }
    }
  }
  return environmentVariables;
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
        isValid(gomodModCompatibility.replace(regEx(/^v/), ''))
      ) {
        installMarwanModArgs = installMarwanModArgs.replace(
          regEx(/@latest$/),
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

  const [, majorPart, minorPart] = regEx(/(\d+)\.(\d+)/).exec(goVersion) ?? [];
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

  try {
    const massagedGoMod = newGoModContent.replace(
      regEx(/\n(replace\s+[^\s]+\s+=>\s+\.\.\/.*)/g),
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
        GOPATH: await ensureCacheDir('go'),
        GOPROXY: process.env.GOPROXY,
        GOPRIVATE: process.env.GOPRIVATE,
        GONOPROXY: process.env.GONOPROXY,
        GONOSUMDB: process.env.GONOSUMDB,
        GOSUMDB: process.env.GOSUMDB,
        GOFLAGS: useModcacherw(config.constraints?.go) ? '-modcacherw' : null,
        CGO_ENABLED: GlobalConfig.get('binarySource') === 'docker' ? '0' : null,
        ...getGitEnvironmentVariables(),
      },
      docker: {
        image: 'go',
        tagConstraint: config.constraints?.go,
        tagScheme: 'npm',
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

    const mustSkipGoModTidy =
      !config.postUpdateOptions?.includes('gomodUpdateImportPaths') &&
      config.updateType === 'major';
    if (mustSkipGoModTidy) {
      logger.debug({ cmd, args }, 'go mod tidy command skipped');
    }

    const isGoModTidyRequired =
      !mustSkipGoModTidy &&
      (config.postUpdateOptions?.includes('gomodTidy') ||
        (config.updateType === 'major' && isImportPathUpdateRequired));
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
    ).replace(regEx(/\/\/ renovate-replace /g), '');
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
