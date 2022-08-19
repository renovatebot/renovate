import is from '@sindresorhus/is';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { PlatformId } from '../../../constants';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import type { HostRule } from '../../../types';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  ensureCacheDir,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import { getGitAuthenticatedEnvironmentVariables } from '../../../util/git/auth';
import { find, getAll } from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
import { createURLFromHostOrURL, validateUrl } from '../../../util/url';
import { isValid } from '../../versioning/semver';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types';

const githubApiUrls = new Set([
  'github.com',
  'api.github.com',
  'https://api.github.com',
  'https://api.github.com/',
]);

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
  // filter rules without `matchHost` and `token` and github api github rules
  const hostRules = getAll()
    .filter((r) => r.matchHost && r.token)
    .filter((r) => !githubToken || !githubApiUrls.has(r.matchHost!));

  const goGitAllowedHostType = new Set<string>([
    // All known git platforms
    PlatformId.Azure,
    PlatformId.Bitbucket,
    PlatformId.BitbucketServer,
    PlatformId.Gitea,
    PlatformId.Github,
    PlatformId.Gitlab,
  ]);

  // for each hostRule without hostType we add additional authentication variables to the environmentVariables
  for (const hostRule of hostRules) {
    if (!hostRule.hostType) {
      environmentVariables = addAuthFromHostRule(
        hostRule,
        environmentVariables
      );
    }
  }

  // for each hostRule with hostType we add additional authentication variables to the environmentVariables
  for (const hostRule of hostRules) {
    if (hostRule.hostType && goGitAllowedHostType.has(hostRule.hostType)) {
      environmentVariables = addAuthFromHostRule(
        hostRule,
        environmentVariables
      );
    }
  }
  return environmentVariables;
}

function addAuthFromHostRule(
  hostRule: HostRule,
  env: NodeJS.ProcessEnv
): NodeJS.ProcessEnv {
  let environmentVariables = env;
  const httpUrl = createURLFromHostOrURL(hostRule.matchHost!)?.toString();
  if (validateUrl(httpUrl)) {
    logger.debug(
      // TODO: types (#7154)
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `Adding Git authentication for Go Module retrieval for ${httpUrl} using token auth.`
    );
    environmentVariables = getGitAuthenticatedEnvironmentVariables(
      httpUrl!,
      hostRule,
      environmentVariables
    );
  } else {
    logger.warn(
      `Could not parse registryUrl ${hostRule.matchHost!} or not using http(s). Ignoring`
    );
  }
  return environmentVariables;
}

function getUpdateImportPathCmds(
  updatedDeps: PackageDependency[],
  { constraints, newMajor }: UpdateArtifactsConfig
): string[] {
  const updateImportCommands = updatedDeps
    .map((dep) => dep.depName!)
    .filter((x) => !x.startsWith('gopkg.in'))
    // TODO: types (#7154)
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
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

function useModcacherw(goVersion: string | undefined): boolean {
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
      /(\r?\n)(replace\s+[^\s]+\s+=>\s+\.\.\/.*)/g
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
        'Removed some relative replace statements and comments from go.mod'
      );
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

    const execCommands: string[] = [];

    let args = 'get -d -t ./...';
    logger.debug({ cmd, args }, 'go get command included');
    execCommands.push(`${cmd} ${args}`);

    // Update import paths on major updates above v1
    const isImportPathUpdateRequired =
      config.postUpdateOptions?.includes('gomodUpdateImportPaths') &&
      config.updateType === 'major' &&
      config.newMajor! > 1;
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

    const tidyOpts = config.postUpdateOptions?.includes('gomodTidy1.17')
      ? ' -compat=1.17'
      : '';
    const isGoModTidyRequired =
      !mustSkipGoModTidy &&
      (config.postUpdateOptions?.includes('gomodTidy') ||
        config.postUpdateOptions?.includes('gomodTidy1.17') ||
        (config.updateType === 'major' && isImportPathUpdateRequired));
    if (isGoModTidyRequired) {
      args = 'mod tidy' + tidyOpts;
      logger.debug({ cmd, args }, 'go mod tidy command included');
      execCommands.push(`${cmd} ${args}`);
    }

    if (useVendor) {
      args = 'mod vendor';
      logger.debug({ cmd, args }, 'go mod vendor command included');
      execCommands.push(`${cmd} ${args}`);
      if (isGoModTidyRequired) {
        args = 'mod tidy' + tidyOpts;
        logger.debug({ cmd, args }, 'go mod tidy command included');
        execCommands.push(`${cmd} ${args}`);
      }
    }

    // We tidy one more time as a solution for #6795
    if (isGoModTidyRequired) {
      args = 'mod tidy' + tidyOpts;
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
          type: 'addition',
          path: sumFileName,
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
      for (const f of status.deleted || []) {
        res.push({
          file: {
            type: 'deletion',
            path: f,
          },
        });
      }
    }

    // TODO: throws in tests (#7154)
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
